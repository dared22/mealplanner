from __future__ import annotations

import base64
import hashlib
import http.client
import ipaddress
import os
import re
import socket
import ssl
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from openai import OpenAI
from pydantic import BaseModel

from .schemas import ExtractionEnvelope


class ProviderError(RuntimeError):
    pass


class MediaUnavailableError(ProviderError):
    pass


class RecipeLikelihood(BaseModel):
    likely_recipe: bool
    confidence: float
    reason: str


class MetaInstagramClient:
    def __init__(self):
        self.access_token = os.getenv("META_ACCESS_TOKEN")
        self.ig_user_id = os.getenv("META_IG_USER_ID")
        self.graph_version = os.getenv("META_GRAPH_VERSION", "v26.0")

    def discover(
        self,
        username: str,
        *,
        limit: int,
        after: str | None = None,
    ) -> tuple[list[dict[str, Any]], str | None]:
        if not self.access_token or not self.ig_user_id:
            raise ProviderError("Meta Business Discovery is not configured")
        media_args = f"limit({limit})"
        if after:
            media_args += f".after({after})"
        fields = (
            f"business_discovery.username({username})"
            f"{{media.{media_args}"
            "{id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,"
            "children{id,media_type,media_url,thumbnail_url}}}"
        )
        response = httpx.get(
            f"https://graph.facebook.com/{self.graph_version}/{self.ig_user_id}",
            params={"fields": fields, "access_token": self.access_token},
            timeout=30,
        )
        if response.status_code >= 400:
            detail = response.json().get("error", {}).get("message", "Meta API error")
            raise ProviderError(detail)
        media = (
            response.json()
            .get("business_discovery", {})
            .get("media", {})
        )
        posts = media.get("data", [])
        next_cursor = media.get("paging", {}).get("cursors", {}).get("after")
        return posts, next_cursor


def _validate_public_https_url(
    url: str, allowed_domains: list[str]
) -> tuple[Any, str]:
    parsed = urlparse(url)
    try:
        hostname = (parsed.hostname or "").lower()
        port = parsed.port
    except ValueError as exc:
        raise ProviderError("Linked page URL is invalid") from exc
    if (
        parsed.scheme != "https"
        or hostname not in set(allowed_domains)
        or port not in {None, 443}
    ):
        raise ProviderError("Linked page is outside the creator's HTTPS allowlist")
    try:
        addresses = socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ProviderError("Linked page hostname could not be resolved") from exc
    if not addresses:
        raise ProviderError("Linked page hostname could not be resolved")
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
        ):
            raise ProviderError("Linked page resolved to a non-public address")
    return parsed, addresses[0][4][0]


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    """Connect to a validated address while retaining hostname TLS checks."""

    def __init__(self, hostname: str, address: str, *, timeout: float):
        super().__init__(
            hostname,
            port=443,
            timeout=timeout,
            context=ssl.create_default_context(),
        )
        self._validated_address = address

    def connect(self) -> None:
        self.sock = socket.create_connection(
            (self._validated_address, self.port),
            self.timeout,
            self.source_address,
        )
        self.sock = self._context.wrap_socket(
            self.sock,
            server_hostname=self.host,
        )


def fetch_allowlisted_page(url: str, allowed_domains: list[str]) -> str:
    current = url
    for _ in range(4):
        parsed, address = _validate_public_https_url(current, allowed_domains)
        connection = _PinnedHTTPSConnection(
            parsed.hostname or "", address, timeout=15
        )
        target = parsed.path or "/"
        if parsed.params:
            target += f";{parsed.params}"
        if parsed.query:
            target += f"?{parsed.query}"
        try:
            connection.request(
                "GET",
                target,
                headers={"User-Agent": "MealplannerRecipeImporter/1.0"},
            )
            response = connection.getresponse()
            if response.status in {301, 302, 303, 307, 308}:
                location = response.getheader("location")
                if not location:
                    raise ProviderError("Linked page redirect has no location")
                current = urljoin(current, location)
                continue
            if response.status >= 400:
                raise ProviderError("Linked page request failed")
            content_type = response.getheader("content-type", "")
            if "text/html" not in content_type and "text/plain" not in content_type:
                raise ProviderError("Linked page is not HTML or plain text")
            content = bytearray()
            while chunk := response.read(64 * 1024):
                content.extend(chunk)
                if len(content) > 500_000:
                    raise ProviderError("Linked page exceeds 500 KB")
            encoding = response.headers.get_content_charset() or "utf-8"
            return content.decode(encoding, errors="replace")
        except (OSError, http.client.HTTPException) as exc:
            raise ProviderError("Linked page request failed") from exc
        finally:
            connection.close()
    raise ProviderError("Linked page redirected too many times")


class OpenAIRecipeExtractor:
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(api_key=api_key) if api_key else None
        self.classifier_model = os.getenv(
            "RECIPE_CLASSIFIER_MODEL", "gpt-5.6-luna"
        )
        self.extractor_model = os.getenv(
            "RECIPE_EXTRACTOR_MODEL", "gpt-5.6-terra"
        )

    def _require_client(self) -> OpenAI:
        if self.client is None:
            raise ProviderError("OpenAI is not configured")
        return self.client

    def classify(self, text: str) -> RecipeLikelihood:
        try:
            response = self._require_client().responses.parse(
                model=self.classifier_model,
                input=[
                    {
                        "role": "system",
                        "content": (
                            "Classify recall-first whether the material likely contains "
                            "one or more reproducible food recipes. When uncertain, say "
                            "likely_recipe=true. Do not infer recipe details."
                        ),
                    },
                    {"role": "user", "content": text[:100_000]},
                ],
                text_format=RecipeLikelihood,
            )
        except Exception:
            raise ProviderError("Recipe classification failed") from None
        if response.output_parsed is None:
            raise ProviderError("Classifier returned no structured result")
        return response.output_parsed

    def extract(
        self,
        text: str,
        *,
        source_url: str,
        attribution: str,
        thumbnail_url: str | None,
        image_paths: list[Path] | None = None,
    ) -> ExtractionEnvelope:
        user_content: list[dict[str, Any]] = [
            {
                "type": "input_text",
                "text": (
                    f"Source URL: {source_url}\nAttribution: {attribution}\n\n"
                    f"{text[:150_000]}"
                ),
            }
        ]
        for path in (image_paths or [])[:24]:
            encoded = base64.b64encode(path.read_bytes()).decode("ascii")
            user_content.append(
                {
                    "type": "input_image",
                    "image_url": f"data:image/jpeg;base64,{encoded}",
                }
            )
        try:
            response = self._require_client().responses.parse(
                model=self.extractor_model,
                input=[
                    {
                        "role": "system",
                        "content": (
                            "Extract every recipe present into canonical English. "
                            "Preserve creator-stated values. Never invent or estimate "
                            "missing quantities, yields, times, macros, ingredients, or "
                            "instructions: leave them null or empty. Set source_url and "
                            "attribution exactly as supplied. Use the supplied thumbnail "
                            "URL. Do not mark allergen_reviewed, dietary_reviewed, or "
                            "food_safety_confirmed; those are admin decisions."
                        ),
                    },
                    {"role": "user", "content": user_content},
                ],
                text_format=ExtractionEnvelope,
            )
        except Exception:
            raise ProviderError("Structured recipe extraction failed") from None
        if response.output_parsed is None:
            raise ProviderError("Extractor returned no structured result")
        result = response.output_parsed
        for recipe in result.recipes:
            recipe.source_url = source_url
            recipe.attribution = attribution
            recipe.thumbnail_url = thumbnail_url
        return result

    def transcribe(self, audio_path: Path) -> str:
        try:
            with audio_path.open("rb") as audio:
                response = self._require_client().audio.transcriptions.create(
                    model=os.getenv("RECIPE_TRANSCRIPTION_MODEL", "gpt-4o-transcribe"),
                    file=audio,
                )
        except Exception:
            raise ProviderError("Audio transcription failed") from None
        return response.text

    def ocr_frames(self, image_paths: list[Path]) -> str:
        if not image_paths:
            return ""
        content: list[dict[str, Any]] = [
            {
                "type": "input_text",
                "text": (
                    "Transcribe all visible recipe-related text from these video "
                    "frames. Preserve numbers and units exactly. Do not infer text."
                ),
            }
        ]
        for path in image_paths[:24]:
            encoded = base64.b64encode(path.read_bytes()).decode("ascii")
            content.append(
                {
                    "type": "input_image",
                    "image_url": f"data:image/jpeg;base64,{encoded}",
                }
            )
        try:
            response = self._require_client().responses.create(
                model=self.extractor_model,
                input=[{"role": "user", "content": content}],
            )
        except Exception:
            raise ProviderError("Video-frame OCR failed") from None
        return response.output_text or ""


class CloudinaryThumbnailStore:
    def __init__(self):
        self.cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
        self.api_key = os.getenv("CLOUDINARY_API_KEY")
        self.api_secret = os.getenv("CLOUDINARY_API_SECRET")

    def upload_remote(self, media_url: str, public_id: str) -> str:
        if not self.cloud_name or not self.api_key or not self.api_secret:
            raise ProviderError("Cloudinary is not configured")
        timestamp = int(time.time())
        params = f"folder=recipe-imports&public_id={public_id}&timestamp={timestamp}"
        signature = hashlib.sha1(
            f"{params}{self.api_secret}".encode("utf-8")
        ).hexdigest()
        response = httpx.post(
            f"https://api.cloudinary.com/v1_1/{self.cloud_name}/image/upload",
            data={
                "file": media_url,
                "folder": "recipe-imports",
                "public_id": public_id,
                "timestamp": timestamp,
                "api_key": self.api_key,
                "signature": signature,
            },
            timeout=60,
        )
        if response.status_code >= 400:
            raise ProviderError("Cloudinary thumbnail upload failed")
        return response.json()["secure_url"]

    def upload_bytes(
        self, content: bytes, filename: str, public_id: str
    ) -> dict[str, str]:
        if not self.cloud_name or not self.api_key or not self.api_secret:
            raise ProviderError("Cloudinary is not configured")
        timestamp = int(time.time())
        params = f"folder=recipe-imports/manual&public_id={public_id}&timestamp={timestamp}"
        signature = hashlib.sha1(
            f"{params}{self.api_secret}".encode("utf-8")
        ).hexdigest()
        response = httpx.post(
            f"https://api.cloudinary.com/v1_1/{self.cloud_name}/auto/upload",
            data={
                "folder": "recipe-imports/manual",
                "public_id": public_id,
                "timestamp": timestamp,
                "api_key": self.api_key,
                "signature": signature,
            },
            files={"file": (filename, content)},
            timeout=120,
        )
        if response.status_code >= 400:
            raise ProviderError("Cloudinary media upload failed")
        uploaded = response.json()
        return {
            "secure_url": uploaded["secure_url"],
            "public_id": uploaded["public_id"],
            "resource_type": uploaded["resource_type"],
        }

    def destroy(self, public_id: str, resource_type: str) -> None:
        if not self.cloud_name or not self.api_key or not self.api_secret:
            raise ProviderError("Cloudinary is not configured")
        timestamp = int(time.time())
        params = f"invalidate=true&public_id={public_id}&timestamp={timestamp}"
        signature = hashlib.sha1(
            f"{params}{self.api_secret}".encode("utf-8")
        ).hexdigest()
        response = httpx.post(
            f"https://api.cloudinary.com/v1_1/{self.cloud_name}/{resource_type}/destroy",
            data={
                "public_id": public_id,
                "timestamp": timestamp,
                "invalidate": "true",
                "api_key": self.api_key,
                "signature": signature,
            },
            timeout=30,
        )
        if response.status_code >= 400:
            raise ProviderError("Cloudinary media deletion failed")


def linked_page_text(caption: str, allowed_domains: list[str]) -> str:
    for url in re.findall(r"https://[^\s<>()]+", caption or ""):
        try:
            return fetch_allowlisted_page(url.rstrip(".,;"), allowed_domains)
        except (ProviderError, httpx.HTTPError):
            continue
    return ""


def extract_media_context(
    media_url: str,
    extractor: OpenAIRecipeExtractor,
) -> tuple[str, list[Path], tempfile.TemporaryDirectory]:
    temporary = tempfile.TemporaryDirectory(prefix="recipe-import-")
    temp_path = Path(temporary.name)
    video_path = temp_path / "source.mp4"
    audio_path = temp_path / "audio.mp3"
    frame_pattern = temp_path / "frame-%03d.jpg"

    try:
        with httpx.stream("GET", media_url, timeout=60) as response:
            if response.status_code >= 400:
                raise MediaUnavailableError("Temporary media download failed")
            total = 0
            with video_path.open("wb") as destination:
                for chunk in response.iter_bytes():
                    total += len(chunk)
                    if total > 100 * 1024 * 1024:
                        raise MediaUnavailableError(
                            "Video exceeds the 100 MB import limit"
                        )
                    destination.write(chunk)

        subprocess.run(
            [
                "ffmpeg",
                "-loglevel",
                "error",
                "-i",
                str(video_path),
                "-vn",
                "-acodec",
                "libmp3lame",
                str(audio_path),
            ],
            check=False,
        )
        subprocess.run(
            [
                "ffmpeg",
                "-loglevel",
                "error",
                "-i",
                str(video_path),
                "-vf",
                "fps=1/5,scale=1280:-2",
                "-frames:v",
                "24",
                str(frame_pattern),
            ],
            check=False,
        )
        frames = sorted(temp_path.glob("frame-*.jpg"))
        transcript = (
            extractor.transcribe(audio_path) if audio_path.exists() else ""
        )
        if not transcript and not frames:
            raise MediaUnavailableError("Video yielded no audio or frames")
        return transcript, frames, temporary
    except Exception:
        temporary.cleanup()
        raise


def extract_image_context(
    media_urls: list[str],
) -> tuple[list[Path], tempfile.TemporaryDirectory]:
    temporary = tempfile.TemporaryDirectory(prefix="recipe-import-images-")
    temp_path = Path(temporary.name)
    paths: list[Path] = []
    total = 0
    try:
        with httpx.Client(timeout=30, trust_env=False) as client:
            for index, media_url in enumerate(media_urls[:24]):
                with client.stream("GET", media_url) as response:
                    if response.status_code >= 400:
                        continue
                    if not response.headers.get("content-type", "").startswith(
                        "image/"
                    ):
                        continue
                    path = temp_path / f"image-{index:03d}.jpg"
                    with path.open("wb") as destination:
                        for chunk in response.iter_bytes():
                            total += len(chunk)
                            if total > 50 * 1024 * 1024:
                                raise MediaUnavailableError(
                                    "Images exceed the 50 MB import limit"
                                )
                            destination.write(chunk)
                    paths.append(path)
        if not paths:
            raise MediaUnavailableError("No usable source images were available")
        return paths, temporary
    except Exception:
        temporary.cleanup()
        raise
