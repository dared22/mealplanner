#!/usr/bin/env python3
"""
MCP Server for Neon PostgreSQL Database Access
Provides tools to query and interact with the Neon database.
"""
import os
import json
import logging
from typing import Any, Optional
from contextlib import contextmanager

from mcp.server import Server
from mcp.types import Tool, TextContent
import mcp.server.stdio
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.engine import Engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("neon-db-mcp")

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable must be set")

# Create engine and session factory
engine: Engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@contextmanager
def get_db_session():
    """Context manager for database sessions."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def format_result(rows: list[dict], max_rows: int = 100) -> str:
    """Format query results as JSON."""
    if not rows:
        return json.dumps({"rows": [], "count": 0}, indent=2)

    truncated = len(rows) > max_rows
    display_rows = rows[:max_rows]

    result = {
        "rows": display_rows,
        "count": len(rows),
        "truncated": truncated
    }

    if truncated:
        result["message"] = f"Showing first {max_rows} of {len(rows)} rows"

    return json.dumps(result, indent=2, default=str)


# Initialize MCP server
server = Server("neon-db")


@server.list_tools()
async def list_tools() -> list[Tool]:
    """List available database tools."""
    return [
        Tool(
            name="query",
            description="Execute a SELECT query and return results. Safe for read-only operations.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sql": {
                        "type": "string",
                        "description": "The SELECT SQL query to execute"
                    },
                    "max_rows": {
                        "type": "integer",
                        "description": "Maximum number of rows to return (default: 100)",
                        "default": 100
                    }
                },
                "required": ["sql"]
            }
        ),
        Tool(
            name="execute",
            description="Execute a write SQL statement (INSERT, UPDATE, DELETE, CREATE, ALTER, etc.). Returns affected row count.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sql": {
                        "type": "string",
                        "description": "The SQL statement to execute"
                    }
                },
                "required": ["sql"]
            }
        ),
        Tool(
            name="list_tables",
            description="List all tables in the database with their schemas.",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        Tool(
            name="describe_table",
            description="Get detailed schema information for a specific table including columns, types, and constraints.",
            inputSchema={
                "type": "object",
                "properties": {
                    "table_name": {
                        "type": "string",
                        "description": "Name of the table to describe"
                    }
                },
                "required": ["table_name"]
            }
        ),
        Tool(
            name="get_table_data",
            description="Get all data from a table with optional filtering and limiting.",
            inputSchema={
                "type": "object",
                "properties": {
                    "table_name": {
                        "type": "string",
                        "description": "Name of the table"
                    },
                    "where": {
                        "type": "string",
                        "description": "Optional WHERE clause (without the WHERE keyword)"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of rows to return (default: 100)",
                        "default": 100
                    },
                    "order_by": {
                        "type": "string",
                        "description": "Optional ORDER BY clause (without the ORDER BY keyword)"
                    }
                },
                "required": ["table_name"]
            }
        )
    ]


@server.call_tool()
async def call_tool(name: str, arguments: Any) -> list[TextContent]:
    """Handle tool execution."""
    try:
        if name == "query":
            sql = arguments.get("sql", "")
            max_rows = arguments.get("max_rows", 100)

            with get_db_session() as session:
                result = session.execute(text(sql))
                rows = [dict(row._mapping) for row in result]
                return [TextContent(type="text", text=format_result(rows, max_rows))]

        elif name == "execute":
            sql = arguments.get("sql", "")

            with get_db_session() as session:
                result = session.execute(text(sql))
                session.commit()

                # Get affected rows if available
                rowcount = result.rowcount if hasattr(result, 'rowcount') else None

                return [TextContent(
                    type="text",
                    text=json.dumps({
                        "success": True,
                        "affected_rows": rowcount,
                        "message": f"Statement executed successfully. Affected rows: {rowcount}"
                    }, indent=2)
                )]

        elif name == "list_tables":
            inspector = inspect(engine)
            tables = inspector.get_table_names()

            table_info = []
            for table in tables:
                columns = inspector.get_columns(table)
                table_info.append({
                    "table": table,
                    "column_count": len(columns),
                    "columns": [col["name"] for col in columns]
                })

            return [TextContent(
                type="text",
                text=json.dumps({"tables": table_info}, indent=2)
            )]

        elif name == "describe_table":
            table_name = arguments.get("table_name", "")
            inspector = inspect(engine)

            if table_name not in inspector.get_table_names():
                return [TextContent(
                    type="text",
                    text=json.dumps({"error": f"Table '{table_name}' not found"}, indent=2)
                )]

            columns = inspector.get_columns(table_name)
            pk = inspector.get_pk_constraint(table_name)
            foreign_keys = inspector.get_foreign_keys(table_name)
            indexes = inspector.get_indexes(table_name)

            schema_info = {
                "table": table_name,
                "columns": [
                    {
                        "name": col["name"],
                        "type": str(col["type"]),
                        "nullable": col.get("nullable", True),
                        "default": col.get("default"),
                        "primary_key": col["name"] in (pk.get("constrained_columns", []) if pk else [])
                    }
                    for col in columns
                ],
                "primary_key": pk.get("constrained_columns", []) if pk else [],
                "foreign_keys": [
                    {
                        "columns": fk["constrained_columns"],
                        "referred_table": fk["referred_table"],
                        "referred_columns": fk["referred_columns"]
                    }
                    for fk in foreign_keys
                ],
                "indexes": [
                    {
                        "name": idx["name"],
                        "columns": idx["column_names"],
                        "unique": idx.get("unique", False)
                    }
                    for idx in indexes
                ]
            }

            return [TextContent(type="text", text=json.dumps(schema_info, indent=2))]

        elif name == "get_table_data":
            table_name = arguments.get("table_name", "")
            where_clause = arguments.get("where")
            limit = arguments.get("limit", 100)
            order_by = arguments.get("order_by")

            # Build query
            query = f"SELECT * FROM {table_name}"
            if where_clause:
                query += f" WHERE {where_clause}"
            if order_by:
                query += f" ORDER BY {order_by}"
            query += f" LIMIT {limit}"

            with get_db_session() as session:
                result = session.execute(text(query))
                rows = [dict(row._mapping) for row in result]
                return [TextContent(type="text", text=format_result(rows, limit))]

        else:
            return [TextContent(
                type="text",
                text=json.dumps({"error": f"Unknown tool: {name}"}, indent=2)
            )]

    except Exception as e:
        logger.exception(f"Error executing tool {name}")
        return [TextContent(
            type="text",
            text=json.dumps({"error": str(e)}, indent=2)
        )]


async def main():
    """Run the MCP server."""
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
