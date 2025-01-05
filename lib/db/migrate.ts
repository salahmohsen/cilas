import "dotenv/config";
import { migrate } from "drizzle-orm/neon-http/migrator";
import db from "./drizzle";

// This will run migrations on the database, skipping the ones already applied

await migrate(db, { migrationsFolder: "./db/drizzle" });
