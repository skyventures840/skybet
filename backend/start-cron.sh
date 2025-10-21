#!/bin/bash

echo "Starting Platypus Cron Monitor..."
echo

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$DIR"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH"
    exit 1
fi

# Check if .env file exists
if [ ! -f "../.env" ]; then
    echo "Error: .env file not found in parent directory"
    echo "Please ensure .env file exists with required configuration"
    exit 1
fi

echo "Starting cron monitor with auto-restart..."
echo "Press Ctrl+C to stop"
echo

# Make the script executable
chmod +x start-monitor.js

# Start the monitor
node start-monitor.js