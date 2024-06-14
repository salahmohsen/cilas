import "dotenv/config";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
export const sql = neon(process.env.NEON_DATABASE_URL!);
const db = drizzle(sql, { logger: false });
export default db;
