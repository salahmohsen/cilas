import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "sub" varchar;
  CREATE INDEX "users_sub_idx" ON "users" USING btree ("sub");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "users_sub_idx";
  ALTER TABLE "users" DROP COLUMN "sub";`)
}
