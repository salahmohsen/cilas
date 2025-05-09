import { createEnv } from "@t3-oss/env-nextjs";
import { type } from "arktype";

export const env = createEnv({
  server: {
    NODE_ENV: type("'development' | 'production'"),
    NEON_DATABASE_URL: type("string.url"),
    GOOGLE_CLIENT_SECRET: type("string"),
    GOOGLE_CLIENT_ID: type("string"),
    CLOUDINARY_API_SECRET: type("string"),
    CLOUDINARY_API_KEY: type("string"),
    CLOUDINARY_CLOUD_NAME: type("string"),
    NPMRC_TIPTAP_PRO_TOKEN: type("string"),
    NEW_USER_ROLE: type("'admin' | 'user'"),
    },
  client: {
    NEXT_PUBLIC_BASE_URL: type("string.url")
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEON_DATABASE_URL: process.env.NEON_DATABASE_URL,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    NPMRC_TIPTAP_PRO_TOKEN: process.env.NPMRC_TIPTAP_PRO_TOKEN,
    NEW_USER_ROLE: process.env.NEW_USER_ROLE,
  },
  emptyStringAsUndefined: true
});
