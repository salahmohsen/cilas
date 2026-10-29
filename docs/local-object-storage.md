# Local object storage

The local app uses RustFS 1.0.4, pinned by image digest, with a persistent Docker
volume. The S3 API is `http://127.0.0.1:19002`; its console is
`http://127.0.0.1:19003`. Both bind only to localhost. This is a single-node
development copy, not a redundant production storage deployment.

RustFS fits this setup because it supports standard S3 bucket policies, a
single-container deployment, and a web console under Apache 2.0. Garage is also
maintained and focuses on small distributed installations, but RustFS's prefix
policies map directly onto this app's mixed public and private bucket. MinIO's
community repository is archived.

Sources: [RustFS release](https://github.com/rustfs/rustfs/releases/tag/1.0.4),
[container installation](https://docs.rustfs.com/en/installation/container/docker),
[Garage](https://hub.docker.com/r/dxflrs/garage),
[MinIO repository](https://github.com/minio/minio).

## Clone R2 and connect the local app

With project dependencies and Docker installed, run from this checkout:

```sh
node scripts/clone-r2-local.mjs \
  --source-env /Users/salah/Developer/cilas/.env \
  --app-dir /Users/salah/Developer/cilas
```

The script starts only the separate storage Compose project. It reads the R2
credentials from the explicit source file, copies current objects using rclone,
and downloads both sides to compare their contents. Empty directory markers are
copied separately. It also checks that R2's object names, sizes, and ETags stayed
unchanged during the operation. It does not copy version history or bucket
settings, write to R2, delete destination objects, or reset the database.

Only after verification does it write `.env.development.local` in this checkout and each
explicit `--app-dir`. These overrides select `localhost:5433/cilas_dev` and the
local bucket, region, and credentials. Existing environment overrides are
preserved. Restart an existing app process if it does not reload its environment.
The corresponding `src/env.ts`, `src/payload.config.ts`, and `next.config.ts`
changes must also be present in an additional app checkout.

Generated storage credentials are in `.env.storage.local`, with permissions
`0600`; this file and `.env.development.local` are gitignored. Use those credentials to sign
in to the console. Keep `.env.storage.local` when recreating the container;
running this setup from a different checkout requires the same credentials file
to manage the existing `cilas-local-s3-data` volume.

```sh
docker compose -p cilas-storage --env-file .env.storage.local \
  -f docker-compose.storage.yml up -d --wait
```

## Public images and private files

The bucket policy grants anonymous `GetObject` only for `cilas-local/media/*`.
It does not grant anonymous listing, uploading, or deleting. `spaces/*` and
`applications/*` stay private, and Payload serves them through its existing
authorization checks. All keys retain their original prefixes, so database
relationships and filenames stay valid; Payload generates media URLs from the
configured local public base URL.

The existing `R2_*` configuration names also support local S3. Production uses
the default `R2_REGION=auto`; local RustFS uses `us-east-1`. Next's image optimizer
allows local addresses only in development and only when the configured image
origin is loopback. Its image allowlist includes the configured port and path.
Production rejects any storage endpoint outside Cloudflare R2 HTTPS, and the
clone script refuses to run with `NODE_ENV=production`. Scripts using local
storage must run with `NODE_ENV=development`.

The disposable search-test MinIO service and its storage remain separate.

## Verification on 2026-10-28

- Copied 1,013 objects (1,012 files and one empty directory marker), totaling
  152,879,741 bytes. rclone's download comparison found zero differences; the
  source inventory stayed unchanged during the final copy and verification.
- All 899 media URLs from the app's 417 media records resolved to local object
  keys. A media download and Next's image optimizer returned HTTP 200.
- Authenticated S3 retrieval of a Spaces file succeeded. Anonymous direct
  retrieval, bucket listing, the Payload Spaces file route, and a temporary
  application attachment returned HTTP 403. The temporary attachment was removed.
- TypeScript, focused ESLint, formatting, and whitespace checks passed.
