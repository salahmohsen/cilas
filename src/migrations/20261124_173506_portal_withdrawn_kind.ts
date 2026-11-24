import { type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TYPE "public"."enum_notifications_kind" ADD VALUE IF NOT EXISTS 'withdrawn';`)
}

export async function down(): Promise<void> {
  // PostgreSQL cannot remove an enum value. Keep existing withdrawal rows readable.
}
