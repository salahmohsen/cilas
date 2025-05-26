import { createEnv } from '@t3-oss/env-nextjs';
import { type } from 'arktype';

export const env = createEnv({
  runtimeEnv: {
    NEXT_PUBLIC_BETTER_AUTH_URL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
    NPMRC_TIPTAP_PRO_TOKEN: process.env.NPMRC_TIPTAP_PRO_TOKEN,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    NEON_DATABASE_URL: process.env.NEON_DATABASE_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    NEW_USER_ROLE: process.env.NEW_USER_ROLE,
    NODE_ENV: process.env.NODE_ENV
  },
  server: {
    NODE_ENV: type("'development' | 'production'"),
    NEW_USER_ROLE: type("'admin' | 'user'"),
    NPMRC_TIPTAP_PRO_TOKEN: type('string'),
    CLOUDINARY_API_SECRET: type('string'),
    CLOUDINARY_CLOUD_NAME: type('string'),
    NEON_DATABASE_URL: type('string.url'),
    GOOGLE_CLIENT_SECRET: type('string'),
    CLOUDINARY_API_KEY: type('string'),
    BETTER_AUTH_SECRET: type('string'),
    GOOGLE_CLIENT_ID: type('string')
  },
  client: {
    NEXT_PUBLIC_BETTER_AUTH_URL: type('string.url'),
    NEXT_PUBLIC_BASE_URL: type('string.url')
  },
  emptyStringAsUndefined: true
});
