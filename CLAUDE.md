# Project guidance

Start with the [project README](README.md) for the current architecture,
local setup, tests, deployment workflow, and Neon MCP instructions.

The planner generates daily macro targets once, then chooses recipes from the
database. The rating-based solver falls back to the random database planner.
Keep the authenticated plan-history endpoint because the grocery list uses it.
Recipe administration imports CSV only. Use Alembic for schema changes.

Never run migrations, imports, direct SQL writes, or destructive commands
against production unless the user explicitly authorizes that exact operation.
Use a restore point and the documented Alembic process for existing databases.
