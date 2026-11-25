import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// `display_name` was worked out on read; now it is stored, as the spaces'
// admin title. The backfill writes the name refreshSpaceName
// (src/lib/space-name.ts) would write, as it reads on 2026-11-25, in every
// locale: a community's own name ("Community" when it has none), or its
// course's or programme's title, with an empty locale falling back to
// English as Payload does. It is SQL, not a call to that function, so the
// migration stays as it is when the app code changes.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "spaces_locales" ADD COLUMN "display_name" varchar;

   INSERT INTO "spaces_locales" ("_locale", "_parent_id", "display_name")
   SELECT l.code::"_locales", s.id,
     CASE s.kind
       WHEN 'community' THEN COALESCE(
         NULLIF(trim(own.name), ''), NULLIF(trim(own_en.name), ''), 'Community')
       WHEN 'course' THEN COALESCE(
         NULLIF(trim(c.title), ''), NULLIF(trim(c_en.title), ''), 'Course deleted')
       ELSE COALESCE(
         NULLIF(trim(p.title), ''), NULLIF(trim(p_en.title), ''), 'Programme deleted')
     END
   FROM "spaces" s
   CROSS JOIN (VALUES ('en'), ('ar')) AS l(code)
   LEFT JOIN "spaces_locales" own ON own._parent_id = s.id AND own._locale::text = l.code
   LEFT JOIN "spaces_locales" own_en ON own_en._parent_id = s.id AND own_en._locale = 'en'
   LEFT JOIN "courses_locales" c ON c._parent_id = s.course_id AND c._locale::text = l.code
   LEFT JOIN "courses_locales" c_en ON c_en._parent_id = s.course_id AND c_en._locale = 'en'
   LEFT JOIN "programmes_locales" p ON p._parent_id = s.programme_id AND p._locale::text = l.code
   LEFT JOIN "programmes_locales" p_en ON p_en._parent_id = s.programme_id AND p_en._locale = 'en'
   ON CONFLICT ("_locale", "_parent_id") DO UPDATE SET "display_name" = EXCLUDED."display_name";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "spaces_locales" DROP COLUMN "display_name";`)
}
