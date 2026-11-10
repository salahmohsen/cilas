import { questionDescription } from './lib/question-description'
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tables = await db.execute(sql`SELECT table_name FROM information_schema.columns WHERE table_schema = current_schema() AND column_name = 'description' AND data_type = 'character varying' AND table_name ~ '^(forms|courses|_courses_v)_blocks_'`)
  for (const { table_name: table } of tables.rows as { table_name: string }[]) {
    const rows = await db.execute(sql.raw(`SELECT id, description FROM "${table}" WHERE description IS NOT NULL`))
    for (const row of rows.rows as { id: number; description: string }[]) {
      await db.execute(sql`UPDATE ${sql.identifier(table)} SET description = ${JSON.stringify(questionDescription(row.description))} WHERE id = ${row.id}`)
    }
  }
  await db.execute(sql`
   CREATE TYPE "public"."enum_forms_blocks_phone_default_country" AS ENUM('US', 'CA', 'MX', 'BR', 'AR', 'CO', 'CL', 'PE', 'GB', 'IE', 'FR', 'DE', 'ES', 'IT', 'PT', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'GR', 'UA', 'TR', 'IL', 'AE', 'SA', 'EG', 'NG', 'KE', 'ZA', 'IN', 'PK', 'CN', 'JP', 'KR', 'TW', 'HK', 'SG', 'PH', 'ID', 'TH', 'VN', 'AU', 'NZ');
  CREATE TYPE "public"."enum_courses_blocks_phone_default_country" AS ENUM('US', 'CA', 'MX', 'BR', 'AR', 'CO', 'CL', 'PE', 'GB', 'IE', 'FR', 'DE', 'ES', 'IT', 'PT', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'GR', 'UA', 'TR', 'IL', 'AE', 'SA', 'EG', 'NG', 'KE', 'ZA', 'IN', 'PK', 'CN', 'JP', 'KR', 'TW', 'HK', 'SG', 'PH', 'ID', 'TH', 'VN', 'AU', 'NZ');
  CREATE TYPE "public"."enum__courses_v_blocks_phone_default_country" AS ENUM('US', 'CA', 'MX', 'BR', 'AR', 'CO', 'CL', 'PE', 'GB', 'IE', 'FR', 'DE', 'ES', 'IT', 'PT', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'GR', 'UA', 'TR', 'IL', 'AE', 'SA', 'EG', 'NG', 'KE', 'ZA', 'IN', 'PK', 'CN', 'JP', 'KR', 'TW', 'HK', 'SG', 'PH', 'ID', 'TH', 'VN', 'AU', 'NZ');
  CREATE TABLE "forms_blocks_phone" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"required" boolean,
  	"default_country" "enum_forms_blocks_phone_default_country" DEFAULT 'EG',
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_phone_locales" (
  	"label" varchar,
  	"description" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "courses_blocks_phone" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"required" boolean,
  	"default_country" "enum_courses_blocks_phone_default_country" DEFAULT 'EG',
  	"block_name" varchar
  );
  
  CREATE TABLE "courses_blocks_phone_locales" (
  	"label" varchar,
  	"description" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "_courses_v_blocks_phone" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"required" boolean,
  	"default_country" "enum__courses_v_blocks_phone_default_country" DEFAULT 'EG',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_courses_v_blocks_phone_locales" (
  	"label" varchar,
  	"description" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "forms_blocks_checkbox_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "forms_blocks_email_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "forms_blocks_number_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "forms_blocks_select_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "forms_blocks_text_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "forms_blocks_textarea_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "forms_blocks_radio_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "forms_blocks_checkbox_group_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "forms_blocks_file_upload_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "courses_blocks_text_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "courses_blocks_textarea_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "courses_blocks_radio_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "courses_blocks_checkbox_group_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "courses_blocks_checkbox_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "courses_blocks_select_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "courses_blocks_number_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "courses_blocks_file_upload_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "_courses_v_blocks_text_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "_courses_v_blocks_textarea_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "_courses_v_blocks_radio_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "_courses_v_blocks_checkbox_group_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "_courses_v_blocks_checkbox_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "_courses_v_blocks_select_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "_courses_v_blocks_number_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "_courses_v_blocks_file_upload_locales" ALTER COLUMN "description" SET DATA TYPE jsonb USING description::jsonb;
  ALTER TABLE "forms_blocks_country_locales" ADD COLUMN "description" jsonb;
  ALTER TABLE "forms_blocks_state_locales" ADD COLUMN "description" jsonb;
  ALTER TABLE "forms_blocks_phone" ADD CONSTRAINT "forms_blocks_phone_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_phone_locales" ADD CONSTRAINT "forms_blocks_phone_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_phone"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_phone" ADD CONSTRAINT "courses_blocks_phone_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_phone_locales" ADD CONSTRAINT "courses_blocks_phone_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_blocks_phone"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_phone" ADD CONSTRAINT "_courses_v_blocks_phone_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_phone_locales" ADD CONSTRAINT "_courses_v_blocks_phone_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_blocks_phone"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "forms_blocks_phone_order_idx" ON "forms_blocks_phone" USING btree ("_order");
  CREATE INDEX "forms_blocks_phone_parent_id_idx" ON "forms_blocks_phone" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_phone_path_idx" ON "forms_blocks_phone" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_phone_locales_locale_parent_id_unique" ON "forms_blocks_phone_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_phone_locales_parent_id_idx" ON "forms_blocks_phone_locales" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_phone_order_idx" ON "courses_blocks_phone" USING btree ("_order");
  CREATE INDEX "courses_blocks_phone_parent_id_idx" ON "courses_blocks_phone" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_phone_path_idx" ON "courses_blocks_phone" USING btree ("_path");
  CREATE UNIQUE INDEX "courses_blocks_phone_locales_locale_parent_id_unique" ON "courses_blocks_phone_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "courses_blocks_phone_locales_parent_id_idx" ON "courses_blocks_phone_locales" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_phone_order_idx" ON "_courses_v_blocks_phone" USING btree ("_order");
  CREATE INDEX "_courses_v_blocks_phone_parent_id_idx" ON "_courses_v_blocks_phone" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_phone_path_idx" ON "_courses_v_blocks_phone" USING btree ("_path");
  CREATE UNIQUE INDEX "_courses_v_blocks_phone_locales_locale_parent_id_unique" ON "_courses_v_blocks_phone_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_courses_v_blocks_phone_locales_parent_id_idx" ON "_courses_v_blocks_phone_locales" USING btree ("_parent_id");`)
}

export async function down(_: MigrateDownArgs): Promise<void> {
  throw new Error('Rich descriptions and phone answers cannot safely be reverted to the previous question schema.')
}
