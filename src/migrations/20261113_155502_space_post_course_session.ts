import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `course_session` named a row of the course's old `sessions` array by its
 * text ID; it now names a session (ADR 0011). Each old ID converts through
 * the map the sessions fill wrote (`course-sessions-map.json`: old row ID to
 * session ID). With no old link stored, no map is needed. An old ID the map
 * lacks, or a missing map, stops the migration: a link is never guessed.
 */
const linkOldSessions = async (db: MigrateUpArgs['db']): Promise<void> => {
  const tables = [
    { table: 'space_posts', from: 'course_session', to: 'course_session_id' },
    { table: '_space_posts_v', from: 'version_course_session', to: 'version_course_session_id' },
  ]
  const old = new Set<string>()
  for (const { table, from } of tables) {
    const { rows } = await db.execute(
      sql.raw(`SELECT DISTINCT "${from}" AS id FROM "${table}" WHERE "${from}" IS NOT NULL`),
    )
    for (const row of rows as { id: string }[]) old.add(row.id)
  }
  if (!old.size) return
  const file = resolve(process.env.COURSE_SESSIONS_MAP ?? 'course-sessions-map.json')
  if (!existsSync(file))
    throw new Error(`${old.size} space post link(s) need ${file} (old row ID → session ID).`)
  const map: Record<string, number> = JSON.parse(readFileSync(file, 'utf8'))
  const missing = [...old].filter((id) => !Number.isSafeInteger(map[id]))
  if (missing.length) throw new Error(`Not in ${file}: ${missing.join(', ')}`)
  for (const id of old)
    for (const { table, from, to } of tables)
      await db.execute(
        sql`UPDATE ${sql.identifier(table)} SET ${sql.identifier(to)} = ${map[id]} WHERE ${sql.identifier(from)} = ${id}`,
      )
}

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "space_posts" ADD COLUMN "course_session_id" integer;
  ALTER TABLE "_space_posts_v" ADD COLUMN "version_course_session_id" integer;
  ALTER TABLE "space_posts" ADD CONSTRAINT "space_posts_course_session_id_sessions_id_fk" FOREIGN KEY ("course_session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_space_posts_v" ADD CONSTRAINT "_space_posts_v_version_course_session_id_sessions_id_fk" FOREIGN KEY ("version_course_session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "space_posts_course_session_idx" ON "space_posts" USING btree ("course_session_id");
  CREATE INDEX "_space_posts_v_version_version_course_session_idx" ON "_space_posts_v" USING btree ("version_course_session_id");`)
  await linkOldSessions(db)
  await db.execute(sql`
  ALTER TABLE "space_posts" DROP COLUMN "course_session";
  ALTER TABLE "_space_posts_v" DROP COLUMN "version_course_session";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "space_posts" DROP CONSTRAINT "space_posts_course_session_id_sessions_id_fk";
  
  ALTER TABLE "_space_posts_v" DROP CONSTRAINT "_space_posts_v_version_course_session_id_sessions_id_fk";
  
  DROP INDEX "space_posts_course_session_idx";
  DROP INDEX "_space_posts_v_version_version_course_session_idx";
  ALTER TABLE "space_posts" ADD COLUMN "course_session" varchar;
  ALTER TABLE "_space_posts_v" ADD COLUMN "version_course_session" varchar;
  ALTER TABLE "space_posts" DROP COLUMN "course_session_id";
  ALTER TABLE "_space_posts_v" DROP COLUMN "version_course_session_id";`)
}
