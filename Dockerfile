# syntax=docker/dockerfile:1
# To use this Dockerfile, you have to set `output: 'standalone'` in your next.config.mjs file.
# From https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile

FROM node:22.17.0-alpine AS base

# The pnpm this repo is locked with. Corepack would fetch the latest pnpm,
# which the corepack bundled with this Node cannot run.
RUN npm install -g pnpm@10.11.0

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY patches ./patches
COPY scripts/install-commit-hooks.mjs ./scripts/install-commit-hooks.mjs
RUN --mount=type=cache,id=cilas-pnpm,target=/pnpm/store,sharing=locked \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then pnpm i --frozen-lockfile --store-dir=/pnpm/store; \
  else echo "Lockfile not found." && exit 1; \
  fi


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# next.config validates the environment (src/env.ts) and the build reads
# Payload, so the build needs the runtime variables: Dokploy passes them as
# build arguments. They stay in this stage; the runner stage gets its own at
# run time.
ARG DATABASE_URL
ARG PAYLOAD_SECRET
ARG R2_BUCKET
ARG R2_ACCESS_KEY_ID
ARG R2_SECRET_ACCESS_KEY
ARG R2_ENDPOINT
ARG R2_PUBLIC_URL
ARG R2_REGION=auto
ARG NEXT_PUBLIC_SERVER_URL
# Typesense build values: the browser-side InstantSearch inlines the
# NEXT_PUBLIC_* values at build time, so they must exist in this stage.
ARG TYPESENSE_API_KEY
ARG TYPESENSE_HOST
ARG TYPESENSE_PORT
ARG TYPESENSE_PROTOCOL
ARG NEXT_PUBLIC_TYPESENSE_API_KEY
ARG NEXT_PUBLIC_TYPESENSE_HOST
ARG NEXT_PUBLIC_TYPESENSE_PORT
ARG NEXT_PUBLIC_TYPESENSE_PROTOCOL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
# PostHog: the browser bundle inlines the key, and next.config.ts reads both
# when it builds the /ingest forwarding.
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG RUN_DATABASE_MIGRATIONS=true
ENV DATABASE_URL=$DATABASE_URL PAYLOAD_SECRET=$PAYLOAD_SECRET R2_BUCKET=$R2_BUCKET R2_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY R2_ENDPOINT=$R2_ENDPOINT R2_PUBLIC_URL=$R2_PUBLIC_URL R2_REGION=$R2_REGION NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL TYPESENSE_API_KEY=$TYPESENSE_API_KEY TYPESENSE_HOST=$TYPESENSE_HOST TYPESENSE_PORT=$TYPESENSE_PORT TYPESENSE_PROTOCOL=$TYPESENSE_PROTOCOL NEXT_PUBLIC_TYPESENSE_API_KEY=$NEXT_PUBLIC_TYPESENSE_API_KEY NEXT_PUBLIC_TYPESENSE_HOST=$NEXT_PUBLIC_TYPESENSE_HOST NEXT_PUBLIC_TYPESENSE_PORT=$NEXT_PUBLIC_TYPESENSE_PORT NEXT_PUBLIC_TYPESENSE_PROTOCOL=$NEXT_PUBLIC_TYPESENSE_PROTOCOL NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED 1

# Bring the database up to the schema this code expects, once, before the
# build: `next build` reads Payload to prerender pages, so it needs the new
# tables. A failed migration fails the deploy and the running site stays as
# it was. Payload's `prodMigrations` would instead run in every build worker.
# db:migrate selects static production exports: Lexical's default Node exports
# use top-level dynamic imports that can deadlock under Payload's tsx loader.
RUN case "$RUN_DATABASE_MIGRATIONS" in \
    true) pnpm db:migrate ;; \
    false) echo "Database migrations disabled for this build" ;; \
    *) echo "RUN_DATABASE_MIGRATIONS must be true or false" >&2; exit 1 ;; \
  esac

# Keep compiler work between source changes on the same Dokploy builder.
RUN --mount=type=cache,id=cilas-next,target=/app/.next/cache,sharing=locked \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Scheduled maintenance cannot rely on the web server's dependency trace.
RUN node scripts/build-search-maintenance.mjs

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Remove this line if you do not have this folder
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/.maintenance ./maintenance

USER nextjs

EXPOSE 3000

ENV PORT=3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD HOSTNAME="0.0.0.0" node server.js
