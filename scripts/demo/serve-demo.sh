#!/usr/bin/env bash
# Starts an isolated demo server on port 3100, on a sanitized copy of a source database.
# Usage: DEMO_SOURCE_URL=postgres://cilas:dev@host.docker.internal:5433/cilas_dev \
#   DEMO_ENV_DIR=/path/to/main/checkout scripts/demo/serve-demo.sh
# pg_dump runs in the container, so a database on this machine is host.docker.internal.
# The source is only read by pg_dump. DEMO_ENV_DIR gives .env and .env.development.local
# (payload secret, media storage). No email, captcha or Google sign-in is configured,
# account emails become *.invalid, and search runs on a throwaway Typesense.
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${DEMO_SOURCE_URL:?Set DEMO_SOURCE_URL to the database to copy}"
: "${DEMO_ENV_DIR:?Set DEMO_ENV_DIR to the checkout that holds .env}"
PSQL=(docker exec -i cilas-demo-db psql -q -v ON_ERROR_STOP=1 -U cilas -d cilas_demo)

docker rm -f cilas-demo-db cilas-demo-typesense >/dev/null 2>&1 || true
docker run -d --name cilas-demo-db -p 127.0.0.1:5434:5432 -e POSTGRES_USER=cilas -e POSTGRES_PASSWORD=demo \
  -e POSTGRES_DB=cilas_demo --tmpfs /var/lib/postgresql/data postgres:17-alpine >/dev/null
docker run -d --name cilas-demo-typesense -p 127.0.0.1:18120:8108 --tmpfs /data typesense/typesense:30.2 \
  --data-dir=/data --api-key=demo-disposable-key >/dev/null
until docker exec cilas-demo-db pg_isready -q -U cilas -d cilas_demo; do sleep 1; done
sleep 2

docker exec -e SRC="$DEMO_SOURCE_URL" cilas-demo-db sh -c \
  'pg_dump "$SRC" -Fc --no-owner -f /tmp/src.dump && pg_restore -U cilas -d cilas_demo --no-owner /tmp/src.dump; rm -f /tmp/src.dump'
"${PSQL[@]}" < scripts/demo/sanitize.sql
"${PSQL[@]}" < scripts/demo/prepare.sql
node scripts/demo/set-passwords.mjs | "${PSQL[@]}"

set -a
. "$DEMO_ENV_DIR/.env"
[ -f "$DEMO_ENV_DIR/.env.development.local" ] && . "$DEMO_ENV_DIR/.env.development.local"
set +a
export DATABASE_URL=postgres://cilas:demo@localhost:5434/cilas_demo
export RESEND_API_KEY= EMAIL_FROM_ADDRESS= NEXT_PUBLIC_TURNSTILE_SITE_KEY= TURNSTILE_SECRET_KEY= GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET=
export NEXT_PUBLIC_SERVER_URL=http://localhost:3100 NEXT_PUBLIC_POSTHOG_KEY=
export TYPESENSE_HOST=localhost TYPESENSE_PORT=18120 TYPESENSE_PROTOCOL=http TYPESENSE_API_KEY=demo-disposable-key
export NEXT_PUBLIC_TYPESENSE_HOST=localhost NEXT_PUBLIC_TYPESENSE_PORT=18120 NEXT_PUBLIC_TYPESENSE_PROTOCOL=http NEXT_PUBLIC_TYPESENSE_API_KEY=demo-disposable-key
pnpm db:migrate
exec pnpm exec next dev -p 3100
