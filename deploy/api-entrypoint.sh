#!/bin/sh
set -e
cd /app/apps/api
mkdir -p /data/db
echo "Running prisma migrate deploy..."
npx prisma migrate deploy --schema prisma/schema.prisma
echo "Seeding (idempotent)..."
# No fallback: the seed already exits 0 when the admin table is populated or the SEED_ADMIN_* vars
# are unset, so a non-zero exit is a real failure (placeholder password, database error) and must
# stop the container instead of starting an API with no usable admin.
node dist/prisma-seed.js
echo "Starting API..."
exec node dist/server.js
