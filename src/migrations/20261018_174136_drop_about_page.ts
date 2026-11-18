import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "about" CASCADE;
  DROP TABLE "about_locales" CASCADE;`)

  // What only the About page said moves to the home page's questions
  // (Site settings → FAQ), once: existing questions keep their text.
  // Plain SQL on the tables as they are at this point in the history:
  // Payload's own calls read today's schema, which a fresh database has not
  // reached yet.
  const found = await db.execute(sql`
    SELECT 1 FROM "site_settings_faq_locales"
    WHERE "_locale" = 'en' AND "question" = ${FAQ[0]!.en.question}`)
  if (found.rows.length > 0) return

  await db.execute(sql`
    INSERT INTO "site_settings" ("created_at", "updated_at")
    SELECT now(), now() WHERE NOT EXISTS (SELECT 1 FROM "site_settings")`)
  for (const f of FAQ) {
    await db.execute(sql`
      WITH parent AS (
        SELECT "id" FROM "site_settings" ORDER BY "created_at" DESC LIMIT 1
      ), row AS (
        INSERT INTO "site_settings_faq" ("_order", "_parent_id", "id")
        SELECT
          COALESCE((SELECT max("_order") FROM "site_settings_faq" WHERE "_parent_id" = parent."id"), 0) + 1,
          parent."id",
          replace(gen_random_uuid()::text, '-', '')
        FROM parent
        RETURNING "id"
      )
      INSERT INTO "site_settings_faq_locales" ("_locale", "_parent_id", "question", "answer")
      SELECT copy.locale::"_locales", row."id", copy.question, copy.answer
      FROM row
      CROSS JOIN (VALUES
        ('en', ${f.en.question}, ${f.en.answer}),
        ('ar', ${f.ar.question}, ${f.ar.answer})
      ) AS copy(locale, question, answer)`)
  }
}

const FAQ = [
  {
    en: {
      question: 'How does CILAS teach?',
      answer:
        'CILAS calls it a pedagogy of discovery and attunement. Fellows teach through reading and discussion, often moving between Arabic and English. Instead of grades, fellows write a narrative of each student’s work.',
    },
    ar: {
      question: 'كيف يُدرِّس سيلاس؟',
      answer:
        'يسمّيها سيلاس بيداجوجيا الاكتشاف والتناغم. يُدرِّس الزملاء عبر القراءة والنقاش، وكثيرًا ما تتنقل النقاشات بين العربية والإنجليزية. وبدلًا من الدرجات، يكتب الزملاء سردًا لعمل كل طالب.',
    },
  },
  {
    en: {
      question: 'How is CILAS funded?',
      answer:
        'CILAS aims to be financially independent, sustained by the contributions of its students. Partial scholarships, based on need, go to a limited number of students.',
    },
    ar: {
      question: 'كيف يُموَّل سيلاس؟',
      answer:
        'يسعى سيلاس إلى الاستقلال المالي، ويقوم على مساهمات طلابه. وتُقدَّم منح جزئية بحسب الحاجة لعدد محدود من الطلاب.',
    },
  },
]

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "about" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"cover_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "about_locales" (
  	"title" varchar NOT NULL,
  	"intro" varchar,
  	"body" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "about" ADD CONSTRAINT "about_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "about_locales" ADD CONSTRAINT "about_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "about_cover_idx" ON "about" USING btree ("cover_id");
  CREATE UNIQUE INDEX "about_locales_locale_parent_id_unique" ON "about_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "about_locales_parent_id_idx" ON "about_locales" USING btree ("_parent_id");`)
}
