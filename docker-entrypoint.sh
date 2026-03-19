#!/bin/sh
set -e

# Initialize db.json if it doesn't exist (first run with empty volume)
if [ ! -f /app/data/db.json ]; then
  echo "Initializing database..."
  cp /app/data/db.json.default /app/data/db.json
fi

exec "$@"
