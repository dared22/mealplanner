from types import SimpleNamespace

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
