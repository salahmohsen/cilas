# Source only for disposable search verification. No .env or remote credentials.
export DATABASE_URL=postgres://search_test:disposable@localhost:55439/cilas_search_test
export PAYLOAD_SECRET=local-disposable-private-search-test-secret
export R2_BUCKET=local-test R2_ACCESS_KEY_ID=local-test R2_SECRET_ACCESS_KEY=local-test
export R2_ENDPOINT=http://127.0.0.1:19000 R2_PUBLIC_URL=http://127.0.0.1:19000/local-test
export TYPESENSE_HOST=127.0.0.1 TYPESENSE_PORT=18109 TYPESENSE_PROTOCOL=http
export TYPESENSE_PRIVATE_HOST=127.0.0.1 TYPESENSE_PRIVATE_PORT=18109 TYPESENSE_PRIVATE_PROTOCOL=http
export TYPESENSE_PRIVATE_SEARCH_KEY=disposable-search-test-key TYPESENSE_PRIVATE_WRITE_KEY=disposable-search-test-key
export PRIVATE_SPACES_SEARCH=true NEXT_PUBLIC_SERVER_URL=http://localhost:3000
export PRIVATE_SPACES_SEARCH_KEYS_VERIFIED=true
export NODE_OPTIONS='--conditions=production --no-deprecation'
# Empty values prevent process.loadEnvFile from refilling optional secrets from a local .env.
export TYPESENSE_API_KEY='' NEXT_PUBLIC_TYPESENSE_API_KEY='' RESEND_API_KEY=''
export GOOGLE_CLIENT_ID='' GOOGLE_CLIENT_SECRET='' TURNSTILE_SECRET_KEY='' NEXT_PUBLIC_TURNSTILE_SITE_KEY=''
