from __future__ import annotations

import logging
import os
import socket
import threading
import time

from database import SessionLocal

from .config import imports_enabled
from .pipeline import RecipeImportPipeline
from .repository import RecipeImportRepository


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)


def _keep_lease_alive(
    worker_id: str, job_id, stop_event: threading.Event
) -> None:
    while not stop_event.wait(30):
        try:
            with SessionLocal() as session:
                repository = RecipeImportRepository(session)
                job = repository.get_job(job_id)
                if job is None or job.lease_owner != worker_id:
                    return
                repository.heartbeat(job)
                repository.worker_heartbeat(worker_id, job_id)
        except Exception:
            logger.exception("Failed to renew recipe-import job lease")


def claim_next_job(worker_id: str):
    """Return one claimed job ID, or None while imports are paused."""
    with SessionLocal() as session:
        repository = RecipeImportRepository(session)
        repository.worker_heartbeat(worker_id)
        if not imports_enabled():
            return None
        job = repository.claim_job(worker_id)
        if job is None:
            return None
        job_id = job.id
        repository.worker_heartbeat(worker_id, job_id)
        return job_id


def run() -> None:
    worker_id = os.getenv(
        "RECIPE_IMPORT_WORKER_ID",
        f"{socket.gethostname()}-{os.getpid()}",
    )
    poll_seconds = float(os.getenv("RECIPE_IMPORT_POLL_SECONDS", "3"))
    pipeline = RecipeImportPipeline(
        concurrency=int(os.getenv("RECIPE_IMPORT_POST_CONCURRENCY", "3"))
    )
    logger.info("Recipe-import worker started as %s", worker_id)
    while True:
        job_id = claim_next_job(worker_id)
        if job_id:
            stop_event = threading.Event()
            lease_thread = threading.Thread(
                target=_keep_lease_alive,
                args=(worker_id, job_id, stop_event),
                daemon=True,
            )
            lease_thread.start()
            try:
                pipeline.process_job(job_id)
            except Exception:
                logger.exception("Unexpected recipe-import worker failure for %s", job_id)
            finally:
                stop_event.set()
                lease_thread.join(timeout=2)
                with SessionLocal() as session:
                    RecipeImportRepository(session).worker_heartbeat(worker_id)
        else:
            time.sleep(poll_seconds)


if __name__ == "__main__":
    run()
