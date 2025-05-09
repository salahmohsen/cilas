import { env } from "@/env";
import { neon, NeonConfig, WebSocketConstructor } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let neonConfig: NeonConfig;
let ws: unknown;

if (typeof window === "undefined") {
  const { neonConfig: nodeNeonConfig } = await import("@neondatabase/serverless");
  neonConfig = nodeNeonConfig;
  ws = await import("ws");
  neonConfig.webSocketConstructor = ws as WebSocketConstructor;
}

export const sql = neon(env.NEON_DATABASE_URL!);
export const db = drizzle(sql, {
  logger: false,
  schema,
});

export async function performTransaction<T>(
  callback: (txDb: db) => Promise<T>,
): Promise<T> {
  try {
    await sql`BEGIN TRANSACTION`;
    const result = await callback(db);
    await sql`COMMIT TRANSACTION`;
    return result;
  } catch (error) {
    await sql`ROLLBACK TRANSACTION`.catch((rollbackError) => {
      console.error("Error during rollback:", rollbackError);
    });
    throw error;
  }
}

export type db = typeof db
export default db