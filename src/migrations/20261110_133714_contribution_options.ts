import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "course_price_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"amount" numeric,
  	"default" boolean DEFAULT false
  );
  
  CREATE TABLE "_course_price_options_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"amount" numeric,
  	"default" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cycle_price_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"amount" numeric NOT NULL,
  	"default" boolean DEFAULT false
  );
  
  CREATE TABLE "programme_price_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"amount" numeric,
  	"default" boolean DEFAULT false
  );
  
  CREATE TABLE "_programme_price_options_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"amount" numeric,
  	"default" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "event_price_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"amount" numeric,
  	"default" boolean DEFAULT false
  );
  
  CREATE TABLE "_event_price_options_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"amount" numeric,
  	"default" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  DROP TABLE "course_price_plan_items" CASCADE;
  DROP TABLE "course_price_plans" CASCADE;
  DROP TABLE "course_price_plans_locales" CASCADE;
  DROP TABLE "_course_price_plan_items_v" CASCADE;
  DROP TABLE "_course_price_plans_v" CASCADE;
  DROP TABLE "_course_price_plans_v_locales" CASCADE;
  DROP TABLE "cycle_price_plan_items" CASCADE;
  DROP TABLE "cycle_price_plans" CASCADE;
  DROP TABLE "cycle_price_plans_locales" CASCADE;
  DROP TABLE "event_price_plan_items" CASCADE;
  DROP TABLE "event_price_plans" CASCADE;
  DROP TABLE "event_price_plans_locales" CASCADE;
  DROP TABLE "_event_price_plan_items_v" CASCADE;
  DROP TABLE "_event_price_plans_v" CASCADE;
  DROP TABLE "_event_price_plans_v_locales" CASCADE;
  ALTER TABLE "course_price_options" ADD CONSTRAINT "course_price_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_course_price_options_v" ADD CONSTRAINT "_course_price_options_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cycle_price_options" ADD CONSTRAINT "cycle_price_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cycles_pricing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programme_price_options" ADD CONSTRAINT "programme_price_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programme_price_options_v" ADD CONSTRAINT "_programme_price_options_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programmes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "event_price_options" ADD CONSTRAINT "event_price_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_event_price_options_v" ADD CONSTRAINT "_event_price_options_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "course_price_options_order_idx" ON "course_price_options" USING btree ("_order");
  CREATE INDEX "course_price_options_parent_id_idx" ON "course_price_options" USING btree ("_parent_id");
  CREATE INDEX "_course_price_options_v_order_idx" ON "_course_price_options_v" USING btree ("_order");
  CREATE INDEX "_course_price_options_v_parent_id_idx" ON "_course_price_options_v" USING btree ("_parent_id");
  CREATE INDEX "cycle_price_options_order_idx" ON "cycle_price_options" USING btree ("_order");
  CREATE INDEX "cycle_price_options_parent_id_idx" ON "cycle_price_options" USING btree ("_parent_id");
  CREATE INDEX "programme_price_options_order_idx" ON "programme_price_options" USING btree ("_order");
  CREATE INDEX "programme_price_options_parent_id_idx" ON "programme_price_options" USING btree ("_parent_id");
  CREATE INDEX "_programme_price_options_v_order_idx" ON "_programme_price_options_v" USING btree ("_order");
  CREATE INDEX "_programme_price_options_v_parent_id_idx" ON "_programme_price_options_v" USING btree ("_parent_id");
  CREATE INDEX "event_price_options_order_idx" ON "event_price_options" USING btree ("_order");
  CREATE INDEX "event_price_options_parent_id_idx" ON "event_price_options" USING btree ("_parent_id");
  CREATE INDEX "_event_price_options_v_order_idx" ON "_event_price_options_v" USING btree ("_order");
  CREATE INDEX "_event_price_options_v_parent_id_idx" ON "_event_price_options_v" USING btree ("_parent_id");
  INSERT INTO "course_price_options" ("_order", "_parent_id", "id", "amount", "default")
    SELECT 1, id, md5('course_price_options:' || id::text || ':1'), COALESCE("pricing_override_min", "pricing_override_max"), true
    FROM "courses" WHERE "pricing_override_min" IS NOT NULL OR "pricing_override_max" IS NOT NULL;
  INSERT INTO "course_price_options" ("_order", "_parent_id", "id", "amount", "default")
    SELECT 2, id, md5('course_price_options:' || id::text || ':2'), "pricing_override_max", false
    FROM "courses" WHERE "pricing_override_max" > "pricing_override_min";
  INSERT INTO "_course_price_options_v" ("_order", "_parent_id", "_uuid", "amount", "default")
    SELECT 1, id, md5('_course_price_options_v:' || id::text || ':1'), COALESCE("version_pricing_override_min", "version_pricing_override_max"), true
    FROM "_courses_v" WHERE "version_pricing_override_min" IS NOT NULL OR "version_pricing_override_max" IS NOT NULL;
  INSERT INTO "_course_price_options_v" ("_order", "_parent_id", "_uuid", "amount", "default")
    SELECT 2, id, md5('_course_price_options_v:' || id::text || ':2'), "version_pricing_override_max", false
    FROM "_courses_v" WHERE "version_pricing_override_max" > "version_pricing_override_min";
  INSERT INTO "cycle_price_options" ("_order", "_parent_id", "id", "amount", "default")
    SELECT 1, id, md5('cycle_price_options:' || id::text || ':1'), COALESCE("pricing_min", "pricing_max"), true
    FROM "cycles_pricing" WHERE "pricing_min" IS NOT NULL OR "pricing_max" IS NOT NULL;
  INSERT INTO "cycle_price_options" ("_order", "_parent_id", "id", "amount", "default")
    SELECT 2, id, md5('cycle_price_options:' || id::text || ':2'), "pricing_max", false
    FROM "cycles_pricing" WHERE "pricing_max" > "pricing_min";
  INSERT INTO "programme_price_options" ("_order", "_parent_id", "id", "amount", "default")
    SELECT 1, id, md5('programme_price_options:' || id::text || ':1'), COALESCE("pricing_min", "pricing_max"), true
    FROM "programmes" WHERE "pricing_min" IS NOT NULL OR "pricing_max" IS NOT NULL;
  INSERT INTO "programme_price_options" ("_order", "_parent_id", "id", "amount", "default")
    SELECT 2, id, md5('programme_price_options:' || id::text || ':2'), "pricing_max", false
    FROM "programmes" WHERE "pricing_max" > "pricing_min";
  INSERT INTO "_programme_price_options_v" ("_order", "_parent_id", "_uuid", "amount", "default")
    SELECT 1, id, md5('_programme_price_options_v:' || id::text || ':1'), COALESCE("version_pricing_min", "version_pricing_max"), true
    FROM "_programmes_v" WHERE "version_pricing_min" IS NOT NULL OR "version_pricing_max" IS NOT NULL;
  INSERT INTO "_programme_price_options_v" ("_order", "_parent_id", "_uuid", "amount", "default")
    SELECT 2, id, md5('_programme_price_options_v:' || id::text || ':2'), "version_pricing_max", false
    FROM "_programmes_v" WHERE "version_pricing_max" > "version_pricing_min";
  INSERT INTO "event_price_options" ("_order", "_parent_id", "id", "amount", "default")
    SELECT 1, id, md5('event_price_options:' || id::text || ':1'), COALESCE("pricing_min", "pricing_max"), true
    FROM "events" WHERE "pricing_min" IS NOT NULL OR "pricing_max" IS NOT NULL;
  INSERT INTO "event_price_options" ("_order", "_parent_id", "id", "amount", "default")
    SELECT 2, id, md5('event_price_options:' || id::text || ':2'), "pricing_max", false
    FROM "events" WHERE "pricing_max" > "pricing_min";
  INSERT INTO "_event_price_options_v" ("_order", "_parent_id", "_uuid", "amount", "default")
    SELECT 1, id, md5('_event_price_options_v:' || id::text || ':1'), COALESCE("version_pricing_min", "version_pricing_max"), true
    FROM "_events_v" WHERE "version_pricing_min" IS NOT NULL OR "version_pricing_max" IS NOT NULL;
  INSERT INTO "_event_price_options_v" ("_order", "_parent_id", "_uuid", "amount", "default")
    SELECT 2, id, md5('_event_price_options_v:' || id::text || ':2'), "version_pricing_max", false
    FROM "_events_v" WHERE "version_pricing_max" > "version_pricing_min";
  ALTER TABLE "courses" DROP COLUMN "pricing_override_min";
  ALTER TABLE "courses" DROP COLUMN "pricing_override_max";
  ALTER TABLE "_courses_v" DROP COLUMN "version_pricing_override_min";
  ALTER TABLE "_courses_v" DROP COLUMN "version_pricing_override_max";
  ALTER TABLE "cycles_pricing" DROP COLUMN "pricing_min";
  ALTER TABLE "cycles_pricing" DROP COLUMN "pricing_max";
  ALTER TABLE "programmes" DROP COLUMN "pricing_min";
  ALTER TABLE "programmes" DROP COLUMN "pricing_max";
  ALTER TABLE "_programmes_v" DROP COLUMN "version_pricing_min";
  ALTER TABLE "_programmes_v" DROP COLUMN "version_pricing_max";
  ALTER TABLE "events" DROP COLUMN "pricing_min";
  ALTER TABLE "events" DROP COLUMN "pricing_max";
  ALTER TABLE "_events_v" DROP COLUMN "version_pricing_min";
  ALTER TABLE "_events_v" DROP COLUMN "version_pricing_max";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "course_price_plan_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"amount" numeric
  );
  
  CREATE TABLE "course_price_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "course_price_plans_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "_course_price_plan_items_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"amount" numeric,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_course_price_plans_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_course_price_plans_v_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "cycle_price_plan_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"amount" numeric NOT NULL
  );
  
  CREATE TABLE "cycle_price_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cycle_price_plans_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "event_price_plan_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"amount" numeric
  );
  
  CREATE TABLE "event_price_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "event_price_plans_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "_event_price_plan_items_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"amount" numeric,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_event_price_plans_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_event_price_plans_v_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "courses" ADD COLUMN "pricing_override_min" numeric;
  ALTER TABLE "courses" ADD COLUMN "pricing_override_max" numeric;
  ALTER TABLE "_courses_v" ADD COLUMN "version_pricing_override_min" numeric;
  ALTER TABLE "_courses_v" ADD COLUMN "version_pricing_override_max" numeric;
  ALTER TABLE "cycles_pricing" ADD COLUMN "pricing_min" numeric;
  ALTER TABLE "cycles_pricing" ADD COLUMN "pricing_max" numeric;
  ALTER TABLE "programmes" ADD COLUMN "pricing_min" numeric;
  ALTER TABLE "programmes" ADD COLUMN "pricing_max" numeric;
  ALTER TABLE "_programmes_v" ADD COLUMN "version_pricing_min" numeric;
  ALTER TABLE "_programmes_v" ADD COLUMN "version_pricing_max" numeric;
  ALTER TABLE "events" ADD COLUMN "pricing_min" numeric;
  ALTER TABLE "events" ADD COLUMN "pricing_max" numeric;
  ALTER TABLE "_events_v" ADD COLUMN "version_pricing_min" numeric;
  ALTER TABLE "_events_v" ADD COLUMN "version_pricing_max" numeric;
  ALTER TABLE "course_price_plan_items" ADD CONSTRAINT "course_price_plan_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."course_price_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "course_price_plans" ADD CONSTRAINT "course_price_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "course_price_plans_locales" ADD CONSTRAINT "course_price_plans_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."course_price_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_course_price_plan_items_v" ADD CONSTRAINT "_course_price_plan_items_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_course_price_plans_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_course_price_plans_v" ADD CONSTRAINT "_course_price_plans_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_course_price_plans_v_locales" ADD CONSTRAINT "_course_price_plans_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_course_price_plans_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cycle_price_plan_items" ADD CONSTRAINT "cycle_price_plan_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cycle_price_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cycle_price_plans" ADD CONSTRAINT "cycle_price_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cycles_pricing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cycle_price_plans_locales" ADD CONSTRAINT "cycle_price_plans_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cycle_price_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "event_price_plan_items" ADD CONSTRAINT "event_price_plan_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."event_price_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "event_price_plans" ADD CONSTRAINT "event_price_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "event_price_plans_locales" ADD CONSTRAINT "event_price_plans_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."event_price_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_event_price_plan_items_v" ADD CONSTRAINT "_event_price_plan_items_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_event_price_plans_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_event_price_plans_v" ADD CONSTRAINT "_event_price_plans_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_event_price_plans_v_locales" ADD CONSTRAINT "_event_price_plans_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_event_price_plans_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "course_price_plan_items_order_idx" ON "course_price_plan_items" USING btree ("_order");
  CREATE INDEX "course_price_plan_items_parent_id_idx" ON "course_price_plan_items" USING btree ("_parent_id");
  CREATE INDEX "course_price_plans_order_idx" ON "course_price_plans" USING btree ("_order");
  CREATE INDEX "course_price_plans_parent_id_idx" ON "course_price_plans" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "course_price_plans_locales_locale_parent_id_unique" ON "course_price_plans_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "course_price_plans_locales_parent_id_idx" ON "course_price_plans_locales" USING btree ("_parent_id");
  CREATE INDEX "_course_price_plan_items_v_order_idx" ON "_course_price_plan_items_v" USING btree ("_order");
  CREATE INDEX "_course_price_plan_items_v_parent_id_idx" ON "_course_price_plan_items_v" USING btree ("_parent_id");
  CREATE INDEX "_course_price_plans_v_order_idx" ON "_course_price_plans_v" USING btree ("_order");
  CREATE INDEX "_course_price_plans_v_parent_id_idx" ON "_course_price_plans_v" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_course_price_plans_v_locales_locale_parent_id_unique" ON "_course_price_plans_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_course_price_plans_v_locales_parent_id_idx" ON "_course_price_plans_v_locales" USING btree ("_parent_id");
  CREATE INDEX "cycle_price_plan_items_order_idx" ON "cycle_price_plan_items" USING btree ("_order");
  CREATE INDEX "cycle_price_plan_items_parent_id_idx" ON "cycle_price_plan_items" USING btree ("_parent_id");
  CREATE INDEX "cycle_price_plans_order_idx" ON "cycle_price_plans" USING btree ("_order");
  CREATE INDEX "cycle_price_plans_parent_id_idx" ON "cycle_price_plans" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cycle_price_plans_locales_locale_parent_id_unique" ON "cycle_price_plans_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "cycle_price_plans_locales_parent_id_idx" ON "cycle_price_plans_locales" USING btree ("_parent_id");
  CREATE INDEX "event_price_plan_items_order_idx" ON "event_price_plan_items" USING btree ("_order");
  CREATE INDEX "event_price_plan_items_parent_id_idx" ON "event_price_plan_items" USING btree ("_parent_id");
  CREATE INDEX "event_price_plans_order_idx" ON "event_price_plans" USING btree ("_order");
  CREATE INDEX "event_price_plans_parent_id_idx" ON "event_price_plans" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "event_price_plans_locales_locale_parent_id_unique" ON "event_price_plans_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "event_price_plans_locales_parent_id_idx" ON "event_price_plans_locales" USING btree ("_parent_id");
  CREATE INDEX "_event_price_plan_items_v_order_idx" ON "_event_price_plan_items_v" USING btree ("_order");
  CREATE INDEX "_event_price_plan_items_v_parent_id_idx" ON "_event_price_plan_items_v" USING btree ("_parent_id");
  CREATE INDEX "_event_price_plans_v_order_idx" ON "_event_price_plans_v" USING btree ("_order");
  CREATE INDEX "_event_price_plans_v_parent_id_idx" ON "_event_price_plans_v" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_event_price_plans_v_locales_locale_parent_id_unique" ON "_event_price_plans_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_event_price_plans_v_locales_parent_id_idx" ON "_event_price_plans_v_locales" USING btree ("_parent_id");
  UPDATE "courses" AS parent SET "pricing_override_min" = amounts.low, "pricing_override_max" = amounts.high
    FROM (SELECT "_parent_id", min(amount) AS low, max(amount) AS high FROM "course_price_options" GROUP BY "_parent_id") amounts
    WHERE parent.id = amounts."_parent_id";
  DROP TABLE "course_price_options" CASCADE;
  UPDATE "_courses_v" AS parent SET "version_pricing_override_min" = amounts.low, "version_pricing_override_max" = amounts.high
    FROM (SELECT "_parent_id", min(amount) AS low, max(amount) AS high FROM "_course_price_options_v" GROUP BY "_parent_id") amounts
    WHERE parent.id = amounts."_parent_id";
  DROP TABLE "_course_price_options_v" CASCADE;
  UPDATE "cycles_pricing" AS parent SET "pricing_min" = amounts.low, "pricing_max" = amounts.high
    FROM (SELECT "_parent_id", min(amount) AS low, max(amount) AS high FROM "cycle_price_options" GROUP BY "_parent_id") amounts
    WHERE parent.id = amounts."_parent_id";
  DROP TABLE "cycle_price_options" CASCADE;
  UPDATE "programmes" AS parent SET "pricing_min" = amounts.low, "pricing_max" = amounts.high
    FROM (SELECT "_parent_id", min(amount) AS low, max(amount) AS high FROM "programme_price_options" GROUP BY "_parent_id") amounts
    WHERE parent.id = amounts."_parent_id";
  DROP TABLE "programme_price_options" CASCADE;
  UPDATE "_programmes_v" AS parent SET "version_pricing_min" = amounts.low, "version_pricing_max" = amounts.high
    FROM (SELECT "_parent_id", min(amount) AS low, max(amount) AS high FROM "_programme_price_options_v" GROUP BY "_parent_id") amounts
    WHERE parent.id = amounts."_parent_id";
  DROP TABLE "_programme_price_options_v" CASCADE;
  UPDATE "events" AS parent SET "pricing_min" = amounts.low, "pricing_max" = amounts.high
    FROM (SELECT "_parent_id", min(amount) AS low, max(amount) AS high FROM "event_price_options" GROUP BY "_parent_id") amounts
    WHERE parent.id = amounts."_parent_id";
  DROP TABLE "event_price_options" CASCADE;
  UPDATE "_events_v" AS parent SET "version_pricing_min" = amounts.low, "version_pricing_max" = amounts.high
    FROM (SELECT "_parent_id", min(amount) AS low, max(amount) AS high FROM "_event_price_options_v" GROUP BY "_parent_id") amounts
    WHERE parent.id = amounts."_parent_id";
  DROP TABLE "_event_price_options_v" CASCADE;`)
}
