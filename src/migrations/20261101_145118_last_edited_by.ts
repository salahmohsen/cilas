import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "courses" ADD COLUMN "last_edited_by_id" integer;
  ALTER TABLE "_courses_v" ADD COLUMN "version_last_edited_by_id" integer;
  ALTER TABLE "articles" ADD COLUMN "last_edited_by_id" integer;
  ALTER TABLE "_articles_v" ADD COLUMN "version_last_edited_by_id" integer;
  ALTER TABLE "publications" ADD COLUMN "last_edited_by_id" integer;
  ALTER TABLE "_publications_v" ADD COLUMN "version_last_edited_by_id" integer;
  ALTER TABLE "events" ADD COLUMN "last_edited_by_id" integer;
  ALTER TABLE "_events_v" ADD COLUMN "version_last_edited_by_id" integer;
  ALTER TABLE "courses" ADD CONSTRAINT "courses_last_edited_by_id_users_id_fk" FOREIGN KEY ("last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_courses_v" ADD CONSTRAINT "_courses_v_version_last_edited_by_id_users_id_fk" FOREIGN KEY ("version_last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_last_edited_by_id_users_id_fk" FOREIGN KEY ("last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_last_edited_by_id_users_id_fk" FOREIGN KEY ("version_last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "publications" ADD CONSTRAINT "publications_last_edited_by_id_users_id_fk" FOREIGN KEY ("last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_publications_v" ADD CONSTRAINT "_publications_v_version_last_edited_by_id_users_id_fk" FOREIGN KEY ("version_last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_last_edited_by_id_users_id_fk" FOREIGN KEY ("last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_last_edited_by_id_users_id_fk" FOREIGN KEY ("version_last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "courses_last_edited_by_idx" ON "courses" USING btree ("last_edited_by_id");
  CREATE INDEX "_courses_v_version_version_last_edited_by_idx" ON "_courses_v" USING btree ("version_last_edited_by_id");
  CREATE INDEX "articles_last_edited_by_idx" ON "articles" USING btree ("last_edited_by_id");
  CREATE INDEX "_articles_v_version_version_last_edited_by_idx" ON "_articles_v" USING btree ("version_last_edited_by_id");
  CREATE INDEX "publications_last_edited_by_idx" ON "publications" USING btree ("last_edited_by_id");
  CREATE INDEX "_publications_v_version_version_last_edited_by_idx" ON "_publications_v" USING btree ("version_last_edited_by_id");
  CREATE INDEX "events_last_edited_by_idx" ON "events" USING btree ("last_edited_by_id");
  CREATE INDEX "_events_v_version_version_last_edited_by_idx" ON "_events_v" USING btree ("version_last_edited_by_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "courses" DROP CONSTRAINT "courses_last_edited_by_id_users_id_fk";
  
  ALTER TABLE "_courses_v" DROP CONSTRAINT "_courses_v_version_last_edited_by_id_users_id_fk";
  
  ALTER TABLE "articles" DROP CONSTRAINT "articles_last_edited_by_id_users_id_fk";
  
  ALTER TABLE "_articles_v" DROP CONSTRAINT "_articles_v_version_last_edited_by_id_users_id_fk";
  
  ALTER TABLE "publications" DROP CONSTRAINT "publications_last_edited_by_id_users_id_fk";
  
  ALTER TABLE "_publications_v" DROP CONSTRAINT "_publications_v_version_last_edited_by_id_users_id_fk";
  
  ALTER TABLE "events" DROP CONSTRAINT "events_last_edited_by_id_users_id_fk";
  
  ALTER TABLE "_events_v" DROP CONSTRAINT "_events_v_version_last_edited_by_id_users_id_fk";
  
  DROP INDEX "courses_last_edited_by_idx";
  DROP INDEX "_courses_v_version_version_last_edited_by_idx";
  DROP INDEX "articles_last_edited_by_idx";
  DROP INDEX "_articles_v_version_version_last_edited_by_idx";
  DROP INDEX "publications_last_edited_by_idx";
  DROP INDEX "_publications_v_version_version_last_edited_by_idx";
  DROP INDEX "events_last_edited_by_idx";
  DROP INDEX "_events_v_version_version_last_edited_by_idx";
  ALTER TABLE "courses" DROP COLUMN "last_edited_by_id";
  ALTER TABLE "_courses_v" DROP COLUMN "version_last_edited_by_id";
  ALTER TABLE "articles" DROP COLUMN "last_edited_by_id";
  ALTER TABLE "_articles_v" DROP COLUMN "version_last_edited_by_id";
  ALTER TABLE "publications" DROP COLUMN "last_edited_by_id";
  ALTER TABLE "_publications_v" DROP COLUMN "version_last_edited_by_id";
  ALTER TABLE "events" DROP COLUMN "last_edited_by_id";
  ALTER TABLE "_events_v" DROP COLUMN "version_last_edited_by_id";`)
}
