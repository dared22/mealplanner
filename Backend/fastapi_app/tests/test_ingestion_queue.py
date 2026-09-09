from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy.dialects import postgresql

import ingestion.worker as worker_module
from ingestion.repository import LostLeaseError, RecipeImportRepository


class EmptySession:
    def __init__(self):
        self.statement = None
        self.rolled_back = False

    def scalar(self, statement):
        self.statement = statement
        return None

    def rollback(self):
        self.rolled_back = True


def test_job_claim_uses_skip_locked_and_reclaims_expired_leases():
    session = EmptySession()

    assert RecipeImportRepository(session).claim_job("worker-1") is None

    sql = str(
        session.statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )
    assert "FOR UPDATE SKIP LOCKED" in sql
    assert "lease_expires_at IS NULL" in sql
    assert "lease_expires_at <" in sql
    assert session.rolled_back is True


class WorkerSession:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None


class WorkerRepository:
    claim_calls = 0

    def __init__(self, _session):
        pass

    def worker_heartbeat(self, _worker_id, _job_id=None):
        return None

    def claim_job(self, _worker_id):
        type(self).claim_calls += 1
        raise AssertionError("disabled workers must not claim jobs")


def test_disabled_worker_does_not_claim_queued_imports(monkeypatch):
    WorkerRepository.claim_calls = 0
    monkeypatch.setattr(worker_module, "SessionLocal", WorkerSession)
    monkeypatch.setattr(worker_module, "RecipeImportRepository", WorkerRepository)
    monkeypatch.setattr(worker_module, "imports_enabled", lambda: False, raising=False)

    assert worker_module.claim_next_job("worker-1") is None
    assert WorkerRepository.claim_calls == 0


class LeaseSession:
    def __init__(self, *, scalar_result=None, rowcount=0):
        self.scalar_result = scalar_result
        self.rowcount = rowcount
        self.statement = None
        self.rolled_back = False
        self.committed = False

    def scalar(self, statement):
        self.statement = statement
        return self.scalar_result

    def execute(self, statement):
        self.statement = statement
        return SimpleNamespace(rowcount=self.rowcount)

    def rollback(self):
        self.rolled_back = True

    def commit(self):
        self.committed = True


def test_stale_lease_token_cannot_lock_job_for_side_effects():
    session = LeaseSession()

    with pytest.raises(LostLeaseError):
        RecipeImportRepository(session).require_lease(uuid4(), uuid4())

    sql = str(
        session.statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )
    assert "lease_token" in sql
    assert "FOR UPDATE" in sql
    assert session.rolled_back is True


def test_lease_renewal_is_conditional_on_owner_and_token():
    session = LeaseSession(rowcount=0)

    renewed = RecipeImportRepository(session).renew_lease(
        uuid4(), "worker-1", uuid4()
    )

    sql = str(
        session.statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )
    assert "lease_owner" in sql
    assert "lease_token" in sql
    assert renewed is False
    assert session.committed is True
