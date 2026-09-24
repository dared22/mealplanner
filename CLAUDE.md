# Project guidance

Start with the [project README](README.md) for the current architecture,
local setup, tests, deployment workflow, and Neon MCP instructions.

Never run migrations, imports, direct SQL writes, or destructive commands
against production unless the user explicitly authorizes that exact operation.
Use a restore point and the documented Alembic process for existing databases.
