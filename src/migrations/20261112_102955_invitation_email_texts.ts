import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "email_settings_locales" ADD COLUMN "texts_acceptance_new_account_button" varchar;
  ALTER TABLE "email_settings_locales" ADD COLUMN "texts_invitation_subject" varchar;
  ALTER TABLE "email_settings_locales" ADD COLUMN "texts_invitation_body" varchar;
  ALTER TABLE "email_settings_locales" ADD COLUMN "texts_invitation_google" varchar;
  ALTER TABLE "email_settings_locales" ADD COLUMN "texts_invitation_button" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "email_settings_locales" DROP COLUMN "texts_acceptance_new_account_button";
  ALTER TABLE "email_settings_locales" DROP COLUMN "texts_invitation_subject";
  ALTER TABLE "email_settings_locales" DROP COLUMN "texts_invitation_body";
  ALTER TABLE "email_settings_locales" DROP COLUMN "texts_invitation_google";
  ALTER TABLE "email_settings_locales" DROP COLUMN "texts_invitation_button";`)
}
