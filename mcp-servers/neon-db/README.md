# Neon database MCP server

This MCP server exposes direct SQL access to the PostgreSQL database selected
by `DATABASE_URL`. It is intended for deliberate maintenance and debugging;
it has both read and write capabilities.

## Setup

From this directory, create the environment and verify that the configured
database can be reached:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
DATABASE_URL='postgresql://user:password@host/database?sslmode=require' \
  python3 test_server.py
```

`setup.sh` performs the same virtual-environment installation and connection
check. It does not create or modify configuration for Claude Code or any other
MCP client.

Configure your MCP client separately to run the existing `server.py` at its
current configured filesystem path, with `DATABASE_URL` in that process's
environment. Do not move that external path or rename the server tools as part
of routine project work.

The server accepts ordinary PostgreSQL URLs as well as legacy `postgres://`
URLs and connects through SQLAlchemy with psycopg 3.

## Available tools

The MCP surface is intentionally small and stable:

- `query` runs a read query and formats its result as JSON.
- `execute` runs a write or DDL statement and commits it.
- `list_tables` lists tables and their columns.
- `describe_table` shows a table's columns, keys, and indexes.
- `get_table_data` retrieves rows with optional filtering and ordering.

The `execute` and `get_table_data` tools pass SQL fragments directly to the
database. Use them only with reviewed input and a least-privilege database
role.

## Safe operating practice

Read data before changing it, limit result sets, and verify each write with a
follow-up query. Take and verify a restore point before schema changes or
material data updates.

Never point this server at production, run destructive SQL, or apply migrations
without explicit authorization for the exact target environment. The project
README documents the required guarded Alembic process for existing databases.
