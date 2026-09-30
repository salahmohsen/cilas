import { createEnv } from '@t3-oss/env-nextjs'
import * as z from 'zod'

// The Payload CLI loads .env but tsx scripts (db:seed, db:migrate:create) do
// not. This covers both without overriding a real environment.
try {
    process.loadEnvFile('.env')
} catch {}

export const env = createEnv({
    server: {
        DATABASE_URL: z.url(),
        PAYLOAD_SECRET: z.string().min(1),

        // disableLocalStorage is on, so there is no local fallback for these.
        R2_BUCKET: z.string().min(1),
        R2_ACCESS_KEY_ID: z.string().min(1),
        R2_SECRET_ACCESS_KEY: z.string().min(1),
        R2_ENDPOINT: z.url(),
        R2_PUBLIC_URL: z.url(),
    },

    // Nothing is client-side yet. New client variables go under `client` with a
    // NEXT_PUBLIC_ prefix and get named here; server keys cannot be read from
    // the client.
    experimental__runtimeEnv: {},

    // Stops a blank R2_SECRET_ACCESS_KEY in .env passing as an empty string and
    // failing later inside the AWS SDK.
    emptyStringAsUndefined: true,
})
