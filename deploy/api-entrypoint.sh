#!/bin/sh
set -e
cd /app/apps/api
mkdir -p /data/db
echo "Running prisma migrate deploy..."
npx prisma migrate deploy --schema prisma/schema.prisma
echo "Seeding (idempotent)..."
node dist/prisma-seed.js || echo "seed skipped"
echo "Starting API..."
exec node dist/server.js
