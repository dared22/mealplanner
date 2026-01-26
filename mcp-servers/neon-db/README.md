# Neon Database MCP Server

This MCP server provides Claude Code with direct access to your Neon PostgreSQL database.

## Setup

1. Install dependencies:
```bash
cd mcp-servers/neon-db
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

2. The server will automatically use the `DATABASE_URL` from your project's `.env` file.

## Available Tools

### `query`
Execute SELECT queries safely.

**Example:**
```
List all users: SELECT * FROM users LIMIT 10
```

### `execute`
Execute write operations (INSERT, UPDATE, DELETE, CREATE, ALTER, etc.).

**Example:**
```
Insert a new user: INSERT INTO users (email) VALUES ('test@example.com')
```

### `list_tables`
List all tables in the database with their columns.

### `describe_table`
Get detailed schema information for a specific table.

**Example:**
```
Describe the preferences table
```

### `get_table_data`
Get data from a table with optional filtering.

**Example:**
```
Get recent preferences: table_name="preferences", order_by="submitted_at DESC", limit=5
```

## Configuration

The server is configured in your Claude Code MCP settings. The configuration automatically loads your database credentials from the `.env` file in your project root.
