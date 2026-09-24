#!/bin/bash
# Setup script for Neon DB MCP Server

set -e

echo "Setting up Neon DB MCP Server..."

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Test connection
echo ""
echo "Testing database connection..."
python test_server.py

echo ""
echo "✓ Setup complete!"
echo ""
echo "Configure your MCP client separately to run this server with DATABASE_URL set."
