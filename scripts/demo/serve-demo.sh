#!/usr/bin/env bash
# Starts an isolated demo server on a sanitized copy of a source database.
# Usage: DEMO_SOURCE_URL=postgres://... scripts/demo/serve-demo.sh
# The source is only read by pg_dump. No email, captcha or Google sign-in is configured,
# account emails become *.invalid, and uploads stay in local storage.
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${DEMO_SOURCE_URL:?Set DEMO_SOURCE_URL to the database to copy}"
PSQL=(docker exec -i cilas-demo-db psql -q -U cilas -d cilas_demo)

docker rm -f cilas-demo-db cilas-demo-typesense >/dev/null 2>&1 || true
docker run -d --name cilas-demo-db -p 127.0.0.1:5434:5432 -e POSTGRES_USER=cilas -e POSTGRES_PASSWORD=demo \
  -e POSTGRES_DB=cilas_demo --tmpfs /var/lib/postgresql/data postgres:17-alpine >/dev/null
docker run -d --name cilas-demo-typesense -p 127.0.0.1:18120:8108 --tmpfs /data typesense/typesense:30.2 \
  --data-dir=/data --api-key=demo-disposable-key >/dev/null
until docker exec cilas-demo-db pg_isready -q -U cilas -d cilas_demo; do sleep 1; done

docker exec -e SRC="$DEMO_SOURCE_URL" cilas-demo-db sh -c \
  'pg_dump "$SRC" -Fc --no-owner -f /tmp/src.dump && pg_restore -U cilas -d cilas_demo --no-owner /tmp/src.dump; rm -f /tmp/src.dump'
"${PSQL[@]}" < scripts/demo/sanitize.sql
"${PSQL[@]}" < scripts/demo/prepare.sql
node scripts/demo/set-passwords.mjs | "${PSQL[@]}"

export DATABASE_URL=postgres://cilas:demo@localhost:5434/cilas_demo
export RESEND_API_KEY= EMAIL_FROM_ADDRESS= NEXT_PUBLIC_TURNSTILE_SITE_KEY= TURNSTILE_SECRET_KEY= GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET=
export NEXT_PUBLIC_SERVER_URL=http://localhost:3000
export TYPESENSE_HOST=localhost TYPESENSE_PORT=18120 TYPESENSE_PROTOCOL=http TYPESENSE_API_KEY=demo-disposable-key
export NEXT_PUBLIC_TYPESENSE_HOST=localhost NEXT_PUBLIC_TYPESENSE_PORT=18120 NEXT_PUBLIC_TYPESENSE_PROTOCOL=http NEXT_PUBLIC_TYPESENSE_API_KEY=demo-disposable-key
export R2_PUBLIC_URL="${DEMO_MEDIA_URL:-$(grep '^R2_PUBLIC_URL=' .env | cut -d= -f2- | tr -d '"')}"
pnpm db:migrate
exec pnpm dev
