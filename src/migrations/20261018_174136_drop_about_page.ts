import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "about" CASCADE;
  DROP TABLE "about_locales" CASCADE;`)

  // What only the About page said moves to the home page's questions
  // (Site settings → FAQ), once: existing questions keep their text.
  const en = await payload.findGlobal({ slug: 'site-settings', locale: 'en', depth: 0, req, overrideAccess: true })
  const old = en.faq ?? []
  if (old.some((f) => f.question === FAQ[0]!.en.question)) return
  const saved = await payload.updateGlobal({
    slug: 'site-settings',
    locale: 'en',
    data: { faq: [...old, ...FAQ.map((f) => f.en)] },
    req,
    overrideAccess: true,
  })
  const ar = await payload.findGlobal({
    slug: 'site-settings',
    locale: 'ar',
    fallbackLocale: false,
    depth: 0,
    req,
    overrideAccess: true,
  })
  const arById = new Map((ar.faq ?? []).map((f) => [f.id, f]))
  await payload.updateGlobal({
    slug: 'site-settings',
    locale: 'ar',
    data: {
      faq: (saved.faq ?? []).map((row, i) => {
        const added = FAQ[i - old.length]
        const kept = arById.get(row.id)
        return added
          ? { id: row.id, ...added.ar }
          : { id: row.id, question: kept?.question ?? row.question, answer: kept?.answer ?? row.answer }
      }),
    },
    req,
    overrideAccess: true,
  })
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
