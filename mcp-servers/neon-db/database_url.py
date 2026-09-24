"""Database URL normalization for the Neon MCP server."""


def coerce_database_url(url: str) -> str:
    """Use SQLAlchemy's psycopg 3 dialect for standard PostgreSQL URLs."""
    for prefix in ("postgres://", "postgresql://", "postgresql+psycopg2://"):
        if url.startswith(prefix):
            return url.replace(prefix, "postgresql+psycopg://", 1)
    return url
