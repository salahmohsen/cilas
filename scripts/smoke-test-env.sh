export DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_ci
export PAYLOAD_SECRET=disposable-ci-smoke-test-secret
export R2_BUCKET=ci-smoke R2_ACCESS_KEY_ID=ci-smoke R2_SECRET_ACCESS_KEY=ci-smoke
export R2_ENDPOINT=https://ci.r2.cloudflarestorage.com R2_PUBLIC_URL=https://ci.example.com
export R2_REGION=auto NEXT_PUBLIC_SERVER_URL=http://localhost:3000
export PRIVATE_SPACES_SEARCH=false PRIVATE_SPACES_SEARCH_KEYS_VERIFIED=false
export TYPESENSE_API_KEY='' NEXT_PUBLIC_TYPESENSE_API_KEY=''
export TYPESENSE_PRIVATE_SEARCH_KEY='' TYPESENSE_PRIVATE_WRITE_KEY=''
export RESEND_API_KEY='' GOOGLE_CLIENT_ID='' GOOGLE_CLIENT_SECRET=''
export TURNSTILE_SECRET_KEY='' NEXT_PUBLIC_TURNSTILE_SITE_KEY='' TMDB_API_READ_TOKEN=''
export NODE_OPTIONS='--conditions=production --no-deprecation'
