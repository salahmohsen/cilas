import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ADR 0007: physical spaces are places. Renames only, so every row stays.
  await db.execute(sql`
  ALTER TABLE "spaces" RENAME TO "places";
  ALTER TABLE "spaces_locales" RENAME TO "places_locales";
  ALTER TABLE "spaces_images" RENAME TO "places_images";
  ALTER SEQUENCE IF EXISTS "spaces_id_seq" RENAME TO "places_id_seq";
  ALTER SEQUENCE IF EXISTS "spaces_locales_id_seq" RENAME TO "places_locales_id_seq";
  ALTER INDEX IF EXISTS "spaces_pkey" RENAME TO "places_pkey";
  ALTER INDEX IF EXISTS "spaces_locales_pkey" RENAME TO "places_locales_pkey";
  ALTER INDEX IF EXISTS "spaces_images_pkey" RENAME TO "places_images_pkey";
  ALTER TYPE "public"."enum_spaces_state" RENAME TO "enum_places_state";

  ALTER TABLE "cycles" RENAME COLUMN "space_id" TO "place_id";
  ALTER TABLE "events" RENAME COLUMN "space_id" TO "place_id";
  ALTER TABLE "email_settings" RENAME COLUMN "address_space_id" TO "address_place_id";
  ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "spaces_id" TO "places_id";

  ALTER TABLE "cycles" RENAME CONSTRAINT "cycles_space_id_spaces_id_fk" TO "cycles_place_id_places_id_fk";
  ALTER TABLE "events" RENAME CONSTRAINT "events_space_id_spaces_id_fk" TO "events_place_id_places_id_fk";
  ALTER TABLE "email_settings" RENAME CONSTRAINT "email_settings_address_space_id_spaces_id_fk" TO "email_settings_address_place_id_places_id_fk";
  ALTER TABLE "payload_locked_documents_rels" RENAME CONSTRAINT "payload_locked_documents_rels_spaces_fk" TO "payload_locked_documents_rels_places_fk";
  ALTER TABLE "places_images" RENAME CONSTRAINT "spaces_images_image_id_media_id_fk" TO "places_images_image_id_media_id_fk";
  ALTER TABLE "places_images" RENAME CONSTRAINT "spaces_images_parent_id_fk" TO "places_images_parent_id_fk";
  ALTER TABLE "places_locales" RENAME CONSTRAINT "spaces_locales_parent_id_fk" TO "places_locales_parent_id_fk";

  ALTER INDEX "spaces_created_at_idx" RENAME TO "places_created_at_idx";
  ALTER INDEX "spaces_updated_at_idx" RENAME TO "places_updated_at_idx";
  ALTER INDEX "spaces_slug_idx" RENAME TO "places_slug_idx";
  ALTER INDEX "spaces_legacy_url_idx" RENAME TO "places_legacy_url_idx";
  ALTER INDEX "spaces_images_order_idx" RENAME TO "places_images_order_idx";
  ALTER INDEX "spaces_images_parent_id_idx" RENAME TO "places_images_parent_id_idx";
  ALTER INDEX "spaces_images_image_idx" RENAME TO "places_images_image_idx";
  ALTER INDEX "spaces_locales_parent_id_idx" RENAME TO "places_locales_parent_id_idx";
  ALTER INDEX "spaces_locales_locale_parent_id_unique" RENAME TO "places_locales_locale_parent_id_unique";
  ALTER INDEX "cycles_space_idx" RENAME TO "cycles_place_idx";
  ALTER INDEX "events_space_idx" RENAME TO "events_place_idx";
  ALTER INDEX "email_settings_address_space_idx" RENAME TO "email_settings_address_place_idx";
  ALTER INDEX "payload_locked_documents_rels_spaces_id_idx" RENAME TO "payload_locked_documents_rels_places_id_idx";
  ALTER INDEX "season_start_year_space_idx" RENAME TO "season_start_year_place_idx";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER INDEX "season_start_year_place_idx" RENAME TO "season_start_year_space_idx";
  ALTER INDEX "payload_locked_documents_rels_places_id_idx" RENAME TO "payload_locked_documents_rels_spaces_id_idx";
  ALTER INDEX "email_settings_address_place_idx" RENAME TO "email_settings_address_space_idx";
  ALTER INDEX "events_place_idx" RENAME TO "events_space_idx";
  ALTER INDEX "cycles_place_idx" RENAME TO "cycles_space_idx";
  ALTER INDEX "places_locales_locale_parent_id_unique" RENAME TO "spaces_locales_locale_parent_id_unique";
  ALTER INDEX "places_locales_parent_id_idx" RENAME TO "spaces_locales_parent_id_idx";
  ALTER INDEX "places_images_image_idx" RENAME TO "spaces_images_image_idx";
  ALTER INDEX "places_images_parent_id_idx" RENAME TO "spaces_images_parent_id_idx";
  ALTER INDEX "places_images_order_idx" RENAME TO "spaces_images_order_idx";
  ALTER INDEX "places_legacy_url_idx" RENAME TO "spaces_legacy_url_idx";
  ALTER INDEX "places_slug_idx" RENAME TO "spaces_slug_idx";
  ALTER INDEX "places_updated_at_idx" RENAME TO "spaces_updated_at_idx";
  ALTER INDEX "places_created_at_idx" RENAME TO "spaces_created_at_idx";

  ALTER TABLE "places_locales" RENAME CONSTRAINT "places_locales_parent_id_fk" TO "spaces_locales_parent_id_fk";
  ALTER TABLE "places_images" RENAME CONSTRAINT "places_images_parent_id_fk" TO "spaces_images_parent_id_fk";
  ALTER TABLE "places_images" RENAME CONSTRAINT "places_images_image_id_media_id_fk" TO "spaces_images_image_id_media_id_fk";
  ALTER TABLE "payload_locked_documents_rels" RENAME CONSTRAINT "payload_locked_documents_rels_places_fk" TO "payload_locked_documents_rels_spaces_fk";
  ALTER TABLE "email_settings" RENAME CONSTRAINT "email_settings_address_place_id_places_id_fk" TO "email_settings_address_space_id_spaces_id_fk";
  ALTER TABLE "events" RENAME CONSTRAINT "events_place_id_places_id_fk" TO "events_space_id_spaces_id_fk";
  ALTER TABLE "cycles" RENAME CONSTRAINT "cycles_place_id_places_id_fk" TO "cycles_space_id_spaces_id_fk";

  ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "places_id" TO "spaces_id";
  ALTER TABLE "email_settings" RENAME COLUMN "address_place_id" TO "address_space_id";
  ALTER TABLE "events" RENAME COLUMN "place_id" TO "space_id";
  ALTER TABLE "cycles" RENAME COLUMN "place_id" TO "space_id";

  ALTER TYPE "public"."enum_places_state" RENAME TO "enum_spaces_state";
  ALTER INDEX IF EXISTS "places_images_pkey" RENAME TO "spaces_images_pkey";
  ALTER INDEX IF EXISTS "places_locales_pkey" RENAME TO "spaces_locales_pkey";
  ALTER INDEX IF EXISTS "places_pkey" RENAME TO "spaces_pkey";
  ALTER SEQUENCE IF EXISTS "places_locales_id_seq" RENAME TO "spaces_locales_id_seq";
  ALTER SEQUENCE IF EXISTS "places_id_seq" RENAME TO "spaces_id_seq";
  ALTER TABLE "places_images" RENAME TO "spaces_images";
  ALTER TABLE "places_locales" RENAME TO "spaces_locales";
  ALTER TABLE "places" RENAME TO "spaces";`)
}
