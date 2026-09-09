from types import SimpleNamespace
from pathlib import Path
from uuid import uuid4

import ingestion.pipeline as pipeline_module
from ingestion.pipeline import RecipeImportPipeline
from ingestion.schemas import ExtractionEnvelope

from test_ingestion_service import complete_candidate_data


class SessionBoundJob:
    def __init__(self, *, job_id, creator_id, payload=None):
        self.id = job_id
        self.creator_id = creator_id
        self.status = "processing"
        self.mode = "new"
        self.cancel_requested = False
        self.discovered_count = 0
        self.processed_count = 0
        self.candidate_count = 0
        self.failed_count = 0
        self._payload = payload
        self._closed = False

    @property
    def payload(self):
        if self._closed:
            raise RuntimeError("job row accessed after its session closed")
        return self._payload


class FakeSession:
    def __init__(self, job):
        self.job = job

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        self.job._closed = True


class PipelineRepository:
    def __init__(self, session):
        self.session = session

    def get_job(self, _job_id):
        return self.session.job

    def get_creator(self, creator_id):
        return SimpleNamespace(id=creator_id, status="active")

    def pending_source_ids(self, _job_id):
        return []

    def refresh_job_counts(self, _job, _lease_token):
        return None

    def finish_job(self, job, *, status, lease_token, error_summary=None):
        job.status = status
        job.error_summary = error_summary


def test_process_job_does_not_access_a_job_row_after_its_session_closes(monkeypatch):
    job_id = uuid4()
    creator_id = uuid4()
    discovery_job = SessionBoundJob(
        job_id=job_id,
        creator_id=creator_id,
        payload={"candidate_id": str(uuid4())},
    )
    completion_job = SessionBoundJob(job_id=job_id, creator_id=creator_id)
    sessions = iter([FakeSession(discovery_job), FakeSession(completion_job)])

    monkeypatch.setattr(pipeline_module, "SessionLocal", lambda: next(sessions))
    monkeypatch.setattr(pipeline_module, "RecipeImportRepository", PipelineRepository)

    RecipeImportPipeline(
        meta=SimpleNamespace(),
        extractor=SimpleNamespace(),
        thumbnails=SimpleNamespace(),
        nutrition=SimpleNamespace(),
    ).process_job(job_id, uuid4())

    assert completion_job.status == "completed"


def test_caption_light_video_is_classified_again_after_media_extraction(monkeypatch):
    source_id = uuid4()
    job_id = uuid4()
    creator_id = uuid4()
    source = SimpleNamespace(
        id=source_id,
        job_id=job_id,
        creator_id=creator_id,
        caption="Watch how I make this",
        source_url="https://www.instagram.com/reel/example",
        thumbnail_url=None,
        cloudinary_thumbnail_url="https://res.cloudinary.com/demo/image/upload/x.jpg",
        media_type="VIDEO",
        raw_metadata={"media_url": "https://video.cdn.example/source.mp4"},
        transcript=None,
        ocr_text=None,
        status="processing",
    )
    job = SimpleNamespace(id=job_id, cancel_requested=False)
    creator = SimpleNamespace(
        id=creator_id,
        instagram_username="mealprepchef",
        allowed_domains=[],
    )

    class MediaRepository:
        def __init__(self, session):
            self.session = session

        def get_source_post(self, requested_id):
            return source if requested_id == source_id else None

        def get_job(self, requested_id):
            return job if requested_id == job_id else None

        def get_creator(self, requested_id):
            return creator if requested_id == creator_id else None

        def create_candidates(self, *_args, **_kwargs):
            source.status = "candidate_created"
            return [SimpleNamespace(id=uuid4())]

        def commit_if_owned(self, _job_id, _lease_token):
            self.session.commit()

    class MediaSession:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def commit(self):
            return None

    class Extractor:
        extractor_model = "test-model"

        def __init__(self):
            self.classification_inputs = []

        def classify(self, text):
            self.classification_inputs.append(text)
            return SimpleNamespace(likely_recipe=len(self.classification_inputs) > 1)

        def ocr_frames(self, _frames):
            return "400 g chicken, bake for 20 minutes"

        def extract(self, *_args, **_kwargs):
            return ExtractionEnvelope(recipes=[complete_candidate_data()])

    temporary = SimpleNamespace(cleanup=lambda: None)
    extractor = Extractor()
    monkeypatch.setattr(pipeline_module, "SessionLocal", MediaSession)
    monkeypatch.setattr(pipeline_module, "RecipeImportRepository", MediaRepository)
    monkeypatch.setattr(
        pipeline_module,
        "extract_media_context",
        lambda *_args: ("Mix the ingredients", [Path("frame.jpg")], temporary),
    )

    result = RecipeImportPipeline(
        extractor=extractor,
        meta=SimpleNamespace(),
        thumbnails=SimpleNamespace(),
        nutrition=SimpleNamespace(enrich=lambda _recipe: None),
    )._process_source(source_id, job_id, lease_token=uuid4())

    assert result == 1
    assert len(extractor.classification_inputs) == 2
    assert "Mix the ingredients" in extractor.classification_inputs[1]
    assert source.status == "candidate_created"
