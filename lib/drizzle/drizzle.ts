import "dotenv/config";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let neonConfig: any;
let ws: any;

if (typeof window === "undefined") {
  const { neonConfig: nodeNeonConfig } = require("@neondatabase/serverless");
  neonConfig = nodeNeonConfig;
  ws = require("ws");

  // Configure WebSocket for Node.js environment
  neonConfig.webSocketConstructor = ws;
}

// For HTTP connections (simple queries) - works in both environments
export const sql = neon(process.env.NEON_DATABASE_URL!);
export const db = drizzle(sql, {
  logger: false,
  schema,
});

// Create a transaction helper that uses HTTP connections
// Only works in nodejs environment
export async function performTransaction<T>(
  callback: (txDb: typeof db) => Promise<T>,
): Promise<T> {
  try {
    // Start transaction
    await sql`BEGIN`;

    // Run the callback with the db instance
    const result = await callback(db);

    // Commit transaction
    await sql`COMMIT`;

    return result;
  } catch (error) {
    // Rollback on error
    await sql`ROLLBACK`.catch((rollbackError) => {
      console.error("Error during rollback:", rollbackError);
    });
    throw error;
  }
}

export default db;
