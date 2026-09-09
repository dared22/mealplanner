from types import SimpleNamespace
from uuid import uuid4

import ingestion.pipeline as pipeline_module
from ingestion.pipeline import RecipeImportPipeline


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

    def refresh_job_counts(self, _job):
        return None

    def finish_job(self, job, *, status, error_summary=None):
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
    ).process_job(job_id)

    assert completion_job.status == "completed"
