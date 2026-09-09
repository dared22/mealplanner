from types import SimpleNamespace
from importlib import util
from pathlib import Path

import pytest

import ingestion.migrate as migrate_module


class SchemaInspector:
    def __init__(self, *, existing_schema: bool, managed: bool):
        self.tables = {
            "recipes": existing_schema,
            "alembic_version": managed,
        }

    def has_table(self, name):
        return self.tables.get(name, False)


def test_existing_database_requires_explicit_baseline_adoption(monkeypatch):
    inspector = SchemaInspector(existing_schema=True, managed=False)
    commands = SimpleNamespace(stamp=lambda *_args: None, upgrade=lambda *_args: None)
    monkeypatch.setattr(migrate_module, "inspect", lambda _engine: inspector)
    monkeypatch.setattr(migrate_module, "command", commands)
    monkeypatch.delenv("ALEMBIC_ADOPT_EXISTING_SCHEMA", raising=False)

    with pytest.raises(RuntimeError, match="Take a Neon restore point"):
        migrate_module.run()


def test_adoption_stamps_baseline_before_upgrading(monkeypatch):
    inspector = SchemaInspector(existing_schema=True, managed=False)
    calls = []
    commands = SimpleNamespace(
        stamp=lambda _config, revision: calls.append(("stamp", revision)),
        upgrade=lambda _config, revision: calls.append(("upgrade", revision)),
    )
    monkeypatch.setattr(migrate_module, "inspect", lambda _engine: inspector)
    monkeypatch.setattr(migrate_module, "command", commands)
    monkeypatch.setenv("ALEMBIC_ADOPT_EXISTING_SCHEMA", "true")

    migrate_module.run()

    assert calls == [
        ("stamp", migrate_module.BASELINE_REVISION),
        ("upgrade", "head"),
    ]


def test_importer_migration_tolerates_a_legacy_non_unique_source_url():
    migration_path = (
        Path(__file__).parents[1]
        / "alembic"
        / "versions"
        / "0002_instagram_recipe_imports.py"
    )
    spec = util.spec_from_file_location("instagram_import_migration", migration_path)
    migration = util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(migration)

    class RecordingOperations:
        def __init__(self):
            self.executed = []
            self.dropped_constraints = []

        def execute(self, statement):
            self.executed.append(str(statement))

        def drop_constraint(self, *args, **kwargs):
            self.dropped_constraints.append((args, kwargs))

        def __getattr__(self, _name):
            return lambda *_args, **_kwargs: None

    operations = RecordingOperations()
    migration.op = operations

    migration.upgrade()

    assert operations.dropped_constraints == []
    assert any(
        "DROP CONSTRAINT IF EXISTS recipes_source_url_key" in statement
        for statement in operations.executed
    )

    with pytest.raises(RuntimeError, match="irreversible"):
        migration.downgrade()
