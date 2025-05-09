import { env } from "@/env";
import type { Config } from "drizzle-kit";
import { defineConfig } from "drizzle-kit";


export default defineConfig({
  schema: "./src/drizzle/schema",
  out: "./src/drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.NEON_DATABASE_URL!,
  },
}) satisfies Config;
