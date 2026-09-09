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
    worker_id: str, job_id, lease_token, stop_event: threading.Event
) -> None:
    while not stop_event.wait(30):
        try:
            with SessionLocal() as session:
                repository = RecipeImportRepository(session)
                if not repository.renew_lease(job_id, worker_id, lease_token):
                    logger.warning("Recipe-import lease lost for job %s", job_id)
                    stop_event.set()
                    return
                repository.worker_heartbeat(worker_id, job_id)
        except Exception:
            logger.exception("Failed to renew recipe-import job lease")


def claim_next_job(worker_id: str):
    """Return a fenced ``(job_id, lease_token)`` claim when work is available."""
    with SessionLocal() as session:
        repository = RecipeImportRepository(session)
        repository.worker_heartbeat(worker_id)
        if not imports_enabled():
            return None
        job = repository.claim_job(worker_id)
        if job is None:
            return None
        claim = (job.id, job.lease_token)
        repository.worker_heartbeat(worker_id, job.id)
        return claim


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
        claim = claim_next_job(worker_id)
        if claim:
            job_id, lease_token = claim
            stop_event = threading.Event()
            lease_thread = threading.Thread(
                target=_keep_lease_alive,
                args=(worker_id, job_id, lease_token, stop_event),
                daemon=True,
            )
            lease_thread.start()
            try:
                pipeline.process_job(job_id, lease_token)
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
