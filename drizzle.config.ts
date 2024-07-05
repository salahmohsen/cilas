import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({
  path: ".env.local",
});

export default defineConfig({
  schema: "./db/db.schema.ts",
  out: "./db/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.NEON_DATABASE_URL!,
  },
});
