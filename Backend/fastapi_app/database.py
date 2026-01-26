import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool


def _coerce_database_url(url: str) -> str:
    """Heroku-style env vars."""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://") and "+psycopg" not in url:
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


raw_database_url = os.getenv("DATABASE_URL")
if not raw_database_url:
    raise RuntimeError("DATABASE_URL is not set")

DATABASE_URL = _coerce_database_url(raw_database_url)

# Neon pooler + psycopg can drop/close idle SSL connections.
# Pre-ping and recycle keep the pool healthy.
connect_args = {}
use_null_pool = "pooler" in DATABASE_URL or os.getenv("DB_DISABLE_POOL", "0") == "1"

engine_kwargs = {
    "echo": False,
    "future": True,
    "connect_args": connect_args,
}

if use_null_pool:
    # Avoid stale pooled connections with managed poolers.
    engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300
    engine_kwargs["pool_size"] = int(os.getenv("DB_POOL_SIZE", "5"))
    engine_kwargs["max_overflow"] = int(os.getenv("DB_MAX_OVERFLOW", "5"))

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    """Base class for ORM models."""


def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
