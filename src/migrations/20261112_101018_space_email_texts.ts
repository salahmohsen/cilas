import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "email_settings_locales" ADD COLUMN "texts_spaces_kicker" varchar;
  ALTER TABLE "email_settings_locales" ADD COLUMN "texts_spaces_digest_subject_one" varchar;
  ALTER TABLE "email_settings_locales" ADD COLUMN "texts_spaces_digest_subject_other" varchar;
  ALTER TABLE "email_settings_locales" ADD COLUMN "texts_spaces_digest_heading" varchar;
  ALTER TABLE "email_settings_locales" ADD COLUMN "texts_spaces_mentions" varchar;
  ALTER TABLE "email_settings_locales" ADD COLUMN "texts_spaces_replies" varchar;
  ALTER TABLE "email_settings_locales" ADD COLUMN "texts_spaces_posts" varchar;
  ALTER TABLE "email_settings_locales" ADD COLUMN "texts_spaces_more" varchar;
  ALTER TABLE "email_settings_locales" ADD COLUMN "texts_spaces_digest_button" varchar;
  ALTER TABLE "email_settings_locales" ADD COLUMN "texts_spaces_announcement_subject" varchar;
  ALTER TABLE "email_settings_locales" ADD COLUMN "texts_spaces_announcement_heading" varchar;
  ALTER TABLE "email_settings_locales" ADD COLUMN "texts_spaces_announcement_button" varchar;
  ALTER TABLE "email_settings_locales" ADD COLUMN "texts_spaces_why" varchar;
  ALTER TABLE "email_settings_locales" ADD COLUMN "texts_spaces_manage" varchar;
  ALTER TABLE "email_settings_locales" ADD COLUMN "texts_spaces_stop" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "email_settings_locales" DROP COLUMN "texts_spaces_kicker";
  ALTER TABLE "email_settings_locales" DROP COLUMN "texts_spaces_digest_subject_one";
  ALTER TABLE "email_settings_locales" DROP COLUMN "texts_spaces_digest_subject_other";
  ALTER TABLE "email_settings_locales" DROP COLUMN "texts_spaces_digest_heading";
  ALTER TABLE "email_settings_locales" DROP COLUMN "texts_spaces_mentions";
  ALTER TABLE "email_settings_locales" DROP COLUMN "texts_spaces_replies";
  ALTER TABLE "email_settings_locales" DROP COLUMN "texts_spaces_posts";
  ALTER TABLE "email_settings_locales" DROP COLUMN "texts_spaces_more";
  ALTER TABLE "email_settings_locales" DROP COLUMN "texts_spaces_digest_button";
  ALTER TABLE "email_settings_locales" DROP COLUMN "texts_spaces_announcement_subject";
  ALTER TABLE "email_settings_locales" DROP COLUMN "texts_spaces_announcement_heading";
  ALTER TABLE "email_settings_locales" DROP COLUMN "texts_spaces_announcement_button";
  ALTER TABLE "email_settings_locales" DROP COLUMN "texts_spaces_why";
  ALTER TABLE "email_settings_locales" DROP COLUMN "texts_spaces_manage";
  ALTER TABLE "email_settings_locales" DROP COLUMN "texts_spaces_stop";`)
}
