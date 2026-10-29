# Production and previews

The `CI` workflow runs on pull requests and pushes to `main`. It checks dependency
advisories, TypeScript, ESLint, unit tests, and a production build in Chromium.
The browser tests cover English and Arabic homepages, contact, study, events, and
login. A disposable Postgres database supplies the current schema and a contact
form. No production credentials are used by the test jobs.

Client Components read public settings from `src/env.client.ts`. ESLint rejects
direct imports of `@/env` in files marked `use client`. The environment regression
tests also exercise production browser imports and production storage validation.

Dokploy's automatic production deployment is disabled. After both CI jobs pass
on `main`, the deployment job checks that the tested commit is still the current
head and calls Dokploy. `DOKPLOY_URL` and a separate `DOKPLOY_API_KEY` are stored
as GitHub Actions secrets. The CI key created on 2026-10-29 expires after one year.
Manual deployments in Dokploy remain available to operators.

GitHub branch protection is unavailable for this private repository on its
current plan. CI gates production deployments, but does not prevent a maintainer
from merging a failing pull request or deploying manually.

Both runtime and Docker build settings use `R2_REGION=auto`. The public origin is
`https://cilas.salahmohsen.com` in production. Preview runtime and build settings
use `https://${{DOKPLOY_DEPLOY_URL}}`, which Dokploy expands to each generated host.

Previews use `*.salahmohsen.com`. Cloudflare terminates public HTTPS and forwards
the Tunnel connection to Traefik over HTTP. Keep Dokploy's preview HTTPS toggle
off and its certificate provider set to `none` for this topology. Do not enable
Let's Encrypt on the internal HTTP route.

Preview email delivery, Google OAuth, Turnstile, and server-side search indexing
are disabled. Private search keys are absent. Public search can still use its
existing read-only browser key. Preview builds set `RUN_DATABASE_MIGRATIONS=false`;
production builds keep it true. Preview data is **not isolated**: the existing
database and media bucket remain shared with production. Preview mutations can
affect those shared resources. Use trusted branches;
separate databases and storage credentials are required for data isolation.

Run the production smoke check locally against a disposable database:

```sh
. ./scripts/smoke-test-env.sh
NODE_ENV=development pnpm exec tsx scripts/bootstrap-smoke.ts
pnpm build
pnpm test:production
```

The fixture script refuses any database URL other than `cilas_ci` on localhost
port 55440. Use Node 22, matching CI and the deployment image. Give it a separate
Postgres service so concurrent development builds cannot exhaust its connections.
