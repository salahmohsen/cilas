import { sql, type MigrateUpArgs } from '@payloadcms/db-postgres'
import { isDeepStrictEqual } from 'node:util'
import {
  programmeEditorial,
  type ProgrammeEditorial,
  type EditorDocument,
} from './lib/programme-editorial'

type Kind = 'document' | 'version'
type Row = ProgrammeEditorial & { id: number }
type Overview = Partial<Record<'en' | 'ar', EditorDocument | null>>
type Context = Pick<MigrateUpArgs, 'payload' | 'req'>
type Args = Context & { db: Pick<MigrateUpArgs['db'], 'execute'> }
const normalized = (value: unknown) =>
  JSON.parse(JSON.stringify(value ?? null, (_, v) => (v === undefined ? null : v)))
const equal = (a: unknown, b: unknown) => isDeepStrictEqual(normalized(a), normalized(b))
type EditorialFields = Pick<Row, 'overview' | 'highlights' | 'testimonials'>
const fieldsOf = (row: Row): EditorialFields => ({
  overview: row.overview ?? {},
  highlights: row.highlights ?? [],
  testimonials: row.testimonials ?? [],
})
const converted = (overview: Overview): EditorialFields => ({
  overview,
  highlights: [],
  testimonials: [],
})

async function current({ payload, req }: Context, kind: Kind, id: number) {
  if (kind === 'document')
    return payload.db.findOne<Row>({
      collection: 'programmes',
      where: { id: { equals: id } },
      locale: 'all',
      req,
    })
  return (
    (
      await payload.db.findVersions<Row>({
        collection: 'programmes',
        where: { id: { equals: id } },
        locale: 'all',
        limit: 1,
        req,
      })
    ).docs[0]?.version ?? null
  )
}

async function write({ payload, req }: Context, kind: Kind, id: number, fields: EditorialFields) {
  const doc = await current({ payload, req }, kind, id)
  if (!doc) throw new Error(`Missing programme ${kind} ${id}`)
  // All-locale adapter writes need the full localized row, not a partial patch.
  const data = { ...doc, ...fields }
  if (kind === 'document') {
    await payload.db.updateOne({ collection: 'programmes', id, locale: 'all', data, req })
  } else {
    const entry = (
      await payload.db.findVersions<Row>({
        collection: 'programmes',
        where: { id: { equals: id } },
        locale: 'all',
        limit: 1,
        req,
      })
    ).docs[0]
    await payload.db.updateVersion({
      collection: 'programmes',
      id,
      locale: 'all',
      versionData: { version: data, createdAt: entry.createdAt, updatedAt: entry.updatedAt },
      req,
    })
  }
}

export async function up({ db, payload, req }: Args): Promise<void> {
  await db.execute(sql`
    LOCK TABLE programmes, _programmes_v IN SHARE ROW EXCLUSIVE MODE;
    CREATE SCHEMA IF NOT EXISTS cilas_migration_archive;
    CREATE TABLE IF NOT EXISTS cilas_migration_archive.programme_editorial_20261029 (
      kind text NOT NULL CHECK (kind IN ('document', 'version')), id integer NOT NULL,
      source jsonb NOT NULL, overview jsonb NOT NULL, PRIMARY KEY (kind, id)
    );
  `)
  const visible = await payload.db.find<{ id: number; name: Partial<Record<'en' | 'ar', string>> }>(
    {
      collection: 'people',
      locale: 'all',
      pagination: false,
      where: { visible: { equals: true } },
      req,
    },
  )
  const people = Object.fromEntries(visible.docs.map((person) => [person.id, person.name]))
  const documents = (await db.execute(sql`SELECT id FROM programmes ORDER BY id`)).rows
  const versions = await payload.db.findVersions<Row>({
    collection: 'programmes',
    locale: 'all',
    pagination: false,
    req,
  })
  for (const [kind, entries] of [
    ['document', documents],
    ['version', versions.docs],
  ] as const) {
    for (const entry of entries) {
      const id = Number(entry.id)
      const doc = await current({ payload, req }, kind, id)
      if (!doc) throw new Error(`Missing programme ${kind} ${id}`)
      const saved = (
        await db.execute(sql`
        SELECT source, overview FROM cilas_migration_archive.programme_editorial_20261029
        WHERE kind = ${kind} AND id = ${id}
      `)
      ).rows[0]
      if (saved) {
        const source = saved.source as Row
        if (equal(fieldsOf(doc), converted(saved.overview as Overview))) continue
        if (!equal(fieldsOf(doc), fieldsOf(source)))
          throw new Error(`Programme ${kind} ${id} changed since its editorial migration`)
        await write({ payload, req }, kind, id, converted(saved.overview as Overview))
        continue
      }
      if (!doc.highlights?.length && !doc.testimonials?.length) continue
      const overview = programmeEditorial(doc, people)
      if (equal(overview, doc.overview)) continue
      await db.execute(sql`
        INSERT INTO cilas_migration_archive.programme_editorial_20261029 (kind, id, source, overview)
        VALUES (${kind}, ${id}, ${JSON.stringify(doc)}::jsonb, ${JSON.stringify(overview)}::jsonb)
      `)
      await write({ payload, req }, kind, id, converted(overview))
    }
  }
}

export async function down({ db, payload, req }: Args): Promise<void> {
  await db.execute(sql`LOCK TABLE programmes, _programmes_v IN SHARE ROW EXCLUSIVE MODE`)
  const { rows } = await db.execute(sql`
    SELECT kind, id, source, overview FROM cilas_migration_archive.programme_editorial_20261029
    ORDER BY kind, id
  `)
  for (const row of rows) {
    if (row.kind !== 'document' && row.kind !== 'version')
      throw new Error('Invalid programme backup kind')
    const doc = await current({ payload, req }, row.kind, Number(row.id))
    if (!doc) continue
    const source = row.source as Row
    if (equal(fieldsOf(doc), fieldsOf(source))) continue
    if (!equal(fieldsOf(doc), converted(row.overview as Overview)))
      throw new Error(
        `Programme ${row.kind} ${row.id} has newer editorial changes; refusing to overwrite them during rollback`,
      )
    await write({ payload, req }, row.kind, Number(row.id), fieldsOf(source))
  }
}
