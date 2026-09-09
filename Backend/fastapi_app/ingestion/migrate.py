from __future__ import annotations

import os

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from database import engine


BASELINE_REVISION = "0001_existing_schema"


def run() -> None:
    config = Config("alembic.ini")
    inspector = inspect(engine)
    existing_schema = inspector.has_table("recipes")
    already_managed = inspector.has_table("alembic_version")
    if existing_schema and not already_managed:
        if os.getenv("ALEMBIC_ADOPT_EXISTING_SCHEMA", "false").lower() not in {
            "1",
            "true",
            "yes",
        }:
            raise RuntimeError(
                "This database predates Alembic. Take a Neon restore point, set "
                "ALEMBIC_ADOPT_EXISTING_SCHEMA=true for one release, then remove it."
            )
        command.stamp(config, BASELINE_REVISION)
    command.upgrade(config, "head")


if __name__ == "__main__":
    run()
