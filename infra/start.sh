#!/bin/sh
# Boot script: restore SQLite from Litestream if present, run migrations, start Litestream+Next.
set -e

cd /app

if [ "${COMPASS_DB_DIALECT:-sqlite}" = "sqlite" ]; then
  SQLITE_PATH="${COMPASS_SQLITE_PATH:-/data/compass.db}"
  mkdir -p "$(dirname "$SQLITE_PATH")"
  if [ ! -f "$SQLITE_PATH" ] && [ -n "$LITESTREAM_REPLICA_URL" ]; then
    echo "[start] no local DB; restoring from $LITESTREAM_REPLICA_URL"
    litestream restore -if-replica-exists -o "$SQLITE_PATH" "$LITESTREAM_REPLICA_URL" || true
  fi
fi

echo "[start] running migrations (dialect=${COMPASS_DB_DIALECT:-sqlite})"
node --import tsx ./packages/db/src/migrate.ts || {
  echo "[start] migration failed"; exit 1;
}

if [ "${COMPASS_DB_DIALECT:-sqlite}" = "sqlite" ] && [ -n "$LITESTREAM_REPLICA_URL" ]; then
  echo "[start] starting Litestream + Next.js"
  exec litestream replicate -exec "pnpm --filter @compass/web start" -config /etc/litestream.yml
else
  exec pnpm --filter @compass/web start
fi
