import os
import sys
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "postgresql://user:password@localhost:5432/mealplanner_test")

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from database import _coerce_database_url


BASELINE_MIGRATION = BACKEND_DIR / "alembic" / "versions" / "0001_existing_schema_baseline.py"
IMPORT_MIGRATION = BACKEND_DIR / "alembic" / "versions" / "0002_instagram_recipe_imports.py"


def test_database_urls_use_the_psycopg_dialect():
    assert _coerce_database_url("postgres://db.example/mealplanner") == "postgresql+psycopg://db.example/mealplanner"
    assert _coerce_database_url("postgresql://db.example/mealplanner") == "postgresql+psycopg://db.example/mealplanner"
    assert _coerce_database_url("postgresql+psycopg://db.example/mealplanner") == "postgresql+psycopg://db.example/mealplanner"


def test_migration_chain_is_complete_and_has_no_removed_ingestion_dependency():
    baseline = BASELINE_MIGRATION.read_text()
    importer = IMPORT_MIGRATION.read_text()

    assert 'revision = "0001_existing_schema"' in baseline
    assert "down_revision = None" in baseline
    assert "alembic stamp 0001_existing_schema" in baseline
    assert "ingestion" not in baseline
    assert 'revision = "0002_instagram_imports"' in importer
    assert 'down_revision = "0001_existing_schema"' in importer
