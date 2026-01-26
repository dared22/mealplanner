# MCP Servers for Meal Planner

This directory contains Model Context Protocol (MCP) servers that extend Claude Code's capabilities for this project.

## Available Servers

### Neon DB Server (`neon-db/`)

Provides direct database access to your Neon PostgreSQL database. Enables Claude to query and modify data without writing code.

**Tools provided:**
- `query` - Execute SELECT queries
- `execute` - Execute write operations (INSERT, UPDATE, DELETE, etc.)
- `list_tables` - List all database tables
- `describe_table` - Get schema details for a table
- `get_table_data` - Fetch data with filtering and pagination

**Setup:**
```bash
cd neon-db
./setup.sh
```

After setup, restart Claude Code to activate the MCP tools.

## What is MCP?

Model Context Protocol (MCP) allows Claude Code to interact with external systems and data sources through standardized tools. Each MCP server exposes specific capabilities that Claude can use to help you work more efficiently.

Learn more: https://modelcontextprotocol.io
