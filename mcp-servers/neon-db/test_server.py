#!/usr/bin/env python3
"""
Test script to verify the MCP server can connect to the database.
"""
import os
import sys
from sqlalchemy import create_engine, text

# Load DATABASE_URL from parent .env
env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.strip() and not line.startswith("#"):
                key, _, value = line.partition("=")
                if key.strip() == "DATABASE_URL":
                    os.environ["DATABASE_URL"] = value.strip().strip('"')

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in environment or .env file")
    sys.exit(1)

print(f"Testing connection to database...")
print(f"Database host: {DATABASE_URL.split('@')[1].split('/')[0] if '@' in DATABASE_URL else 'unknown'}")

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT current_database(), current_user, version()"))
        row = result.fetchone()
        print(f"\n✓ Connection successful!")
        print(f"  Database: {row[0]}")
        print(f"  User: {row[1]}")
        print(f"  Version: {row[2][:50]}...")

        # List tables
        result = conn.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        """))
        tables = [row[0] for row in result]
        print(f"\n✓ Found {len(tables)} tables:")
        for table in tables:
            print(f"  - {table}")

except Exception as e:
    print(f"\n✗ Connection failed: {e}")
    sys.exit(1)

print("\n✓ MCP server is ready to use!")
