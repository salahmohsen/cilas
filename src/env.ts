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

        // Optional: without it Payload logs emails to the console (fine in dev).
        RESEND_API_KEY: z.string().min(1).optional(),
        EMAIL_FROM_ADDRESS: z.email().default('noreply@ci-las.org'),
    },

    // Read by the admin live-preview iframe, which postMessages back to Payload.
    // Payload matches messages with `event.origin === serverURL`, so this must
    // be a real absolute origin. The admin and frontend share one in
    // development, so it is only needed when they are deployed separately.
    client: {
        NEXT_PUBLIC_SERVER_URL: z.string().url().default('http://localhost:3000'),
    },

    experimental__runtimeEnv: {
        NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
    },

    // Stops a blank R2_SECRET_ACCESS_KEY in .env passing as an empty string and
    // failing later inside the AWS SDK.
    emptyStringAsUndefined: true,
})
