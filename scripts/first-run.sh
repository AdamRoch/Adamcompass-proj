#!/usr/bin/env bash
# Compass first-run bootstrap.
# - Installs dependencies (pnpm)
# - Generates a working .env.local with random secrets if missing
# - Runs the initial migration
# - Prints next steps
#
# Usage: ./scripts/first-run.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Verifying tooling"
if ! command -v corepack >/dev/null 2>&1; then
  echo "  corepack not found. Install Node 22+ (which ships corepack)." >&2
  exit 1
fi
corepack enable >/dev/null 2>&1 || true

if ! command -v pnpm >/dev/null 2>&1; then
  echo "  enabling pnpm via corepack..."
  corepack prepare pnpm@9.12.0 --activate
fi

echo "==> Installing dependencies"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

ENV_FILE=".env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "==> Generating $ENV_FILE with random secrets"
  cp .env.example "$ENV_FILE"
  SESS=$(openssl rand -base64 32 | tr -d '\n')
  HMAC=$(openssl rand -base64 32 | tr -d '\n')
  PEPP=$(openssl rand -base64 24 | tr -d '\n')
  # macOS sed needs `-i ''`; GNU sed `-i`. Detect.
  if sed --version >/dev/null 2>&1; then
    SED_INPLACE=(-i)
  else
    SED_INPLACE=(-i '')
  fi
  sed "${SED_INPLACE[@]}" \
    -e "s|COMPASS_SESSION_SECRET=.*|COMPASS_SESSION_SECRET=${SESS}|" \
    -e "s|COMPASS_WEBHOOK_HMAC_SECRET=.*|COMPASS_WEBHOOK_HMAC_SECRET=${HMAC}|" \
    "$ENV_FILE"
  if grep -q '^COMPASS_TOKEN_PEPPER=' "$ENV_FILE"; then
    sed "${SED_INPLACE[@]}" -e "s|COMPASS_TOKEN_PEPPER=.*|COMPASS_TOKEN_PEPPER=${PEPP}|" "$ENV_FILE"
  else
    printf '\nCOMPASS_TOKEN_PEPPER=%s\n' "${PEPP}" >> "$ENV_FILE"
  fi
  if ! grep -q '^COMPASS_BOOTSTRAP_ALLOW_FIRST_USER=' "$ENV_FILE"; then
    printf 'COMPASS_BOOTSTRAP_ALLOW_FIRST_USER=1\n' >> "$ENV_FILE"
  fi
else
  echo "==> $ENV_FILE exists, leaving alone"
fi

# Next.js reads env from the dir it's run in (apps/web). Mirror the root .env.local there so
# `pnpm web` picks up the same secrets without manual duplication.
WEB_ENV="apps/web/.env.local"
if [[ ! -f "$WEB_ENV" ]] || ! cmp -s "$ENV_FILE" "$WEB_ENV"; then
  echo "==> Mirroring $ENV_FILE -> $WEB_ENV"
  cp "$ENV_FILE" "$WEB_ENV"
fi

# Export the vars into the current shell so the migrate step picks them up without --env-file.
set -a
# shellcheck disable=SC1090
. "./$ENV_FILE"
set +a

echo "==> Applying migrations (SQLite by default)"
set +e
pnpm db:migrate
MIGRATE_RC=$?
set -e
if [[ $MIGRATE_RC -ne 0 ]]; then
  echo "  migration failed; check the error above. You may need to install drizzle-kit prerequisites." >&2
  exit $MIGRATE_RC
fi

cat <<EOF

==> Done.

Next:
  pnpm web                # http://localhost:3000
  pnpm cli capture "..."  # capture from the CLI
  pnpm test               # run the Vitest suite
  pnpm test:e2e           # run the Playwright smoke tests (requires playwright install)

After signing in for the first time, remove COMPASS_BOOTSTRAP_ALLOW_FIRST_USER from .env.local.
EOF
