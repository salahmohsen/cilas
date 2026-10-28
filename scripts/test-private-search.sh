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
pnpm exec vitest run tests/unit/private-search.unit.spec.ts tests/unit/private-search-panel.unit.spec.tsx tests/unit/private-space-search.unit.spec.tsx tests/int/private-search.int.spec.ts --reporter=verbose

compose exec -T postgres psql -U search_test -d cilas_search_test -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >/dev/null 2>&1
pnpm exec tsx scripts/bootstrap-search-test.ts
set +e
pnpm exec vitest run tests/int/spaces-core.int.spec.ts tests/int/spaces-write.int.spec.ts --no-file-parallelism --reporter=dot
legacy_status=$?
docker stats --no-stream --format '{{.Name}} {{.MemUsage}} {{.CPUPerc}}' "$(compose ps -q typesense)" "$(compose ps -q postgres)" "$(compose ps -q storage)"

exit "$legacy_status"
