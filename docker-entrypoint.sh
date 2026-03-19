#!/bin/sh
set -e

# Ensure data directory exists (volume mount may create it as root)
mkdir -p /app/data /app/uploads /app/public/uploads/covers

# db.json is auto-created by the Node migrator on first run — nothing to do here

exec "$@"
