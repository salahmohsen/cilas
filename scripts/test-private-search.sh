#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
. ./scripts/search-test-env.sh
compose() { docker compose -f docker-compose.search-test.yml -p cilas-private-search-test "$@"; }
trap 'compose down --volumes >/dev/null' EXIT
compose up --detach --wait --wait-timeout 60
curl --fail --silent --retry 15 --retry-connrefused --retry-delay 1 http://127.0.0.1:18109/health >/dev/null
curl --fail --silent --retry 15 --retry-connrefused --retry-delay 1 http://127.0.0.1:19000/minio/health/live >/dev/null
pnpm exec tsx scripts/bootstrap-search-test.ts
node scripts/verify-search-maintenance.mjs
pnpm exec vitest run src/lib/private-search/private-search.unit.test.ts src/components/private-search-panel.unit.test.tsx src/components/private-space-search.unit.test.tsx src/lib/private-search/private-search.int.test.ts --reporter=verbose

compose exec -T postgres psql -U search_test -d cilas_search_test -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >/dev/null 2>&1
pnpm exec tsx scripts/bootstrap-search-test.ts
set +e
pnpm exec vitest run src/lib/spaces-core.int.test.ts src/lib/spaces-write.int.test.ts --no-file-parallelism --reporter=dot
legacy_status=$?
docker stats --no-stream --format '{{.Name}} {{.MemUsage}} {{.CPUPerc}}' "$(compose ps -q typesense)" "$(compose ps -q postgres)" "$(compose ps -q storage)"

exit "$legacy_status"
