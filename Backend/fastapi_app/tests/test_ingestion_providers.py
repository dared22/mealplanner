from types import SimpleNamespace

import pytest

import ingestion.providers as providers
from ingestion.providers import ProviderError, fetch_allowlisted_page


def test_allowlisted_page_connects_to_the_validated_address(monkeypatch):
    monkeypatch.setattr(
        providers.socket,
        "getaddrinfo",
        lambda *_args, **_kwargs: [
            (providers.socket.AF_INET, providers.socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))
        ],
    )
    connections = []

    class Response:
        status = 200
        headers = SimpleNamespace(get_content_charset=lambda: "utf-8")

        def __init__(self):
            self.chunks = [b"recipe", b""]

        def getheader(self, name, default=None):
            if name == "content-type":
                return "text/plain; charset=utf-8"
            return default

        def read(self, _size):
            return self.chunks.pop(0)

    class Connection:
        def __init__(self, hostname, address, *, timeout):
            connections.append((hostname, address, timeout))

        def request(self, *_args, **_kwargs):
            return None

        def getresponse(self):
            return Response()

        def close(self):
            return None

    monkeypatch.setattr(providers, "_PinnedHTTPSConnection", Connection)

    body = fetch_allowlisted_page(
        "https://recipes.example/dinner", ["recipes.example"]
    )

    assert body == "recipe"
    assert connections == [("recipes.example", "93.184.216.34", 15)]


def test_allowlisted_page_rejects_private_dns_results(monkeypatch):
    monkeypatch.setattr(
        providers.socket,
        "getaddrinfo",
        lambda *_args, **_kwargs: [
            (providers.socket.AF_INET, providers.socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443))
        ],
    )

    with pytest.raises(ProviderError, match="non-public"):
        fetch_allowlisted_page(
            "https://recipes.example/dinner", ["recipes.example"]
        )
