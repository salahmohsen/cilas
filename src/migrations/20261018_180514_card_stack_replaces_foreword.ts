import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // A publication's foreword showed its collection as a card stack. The
  // foreword field goes; each foreword article opens with a Card stack block
  // of its collection instead, in every language it has a body in, on the
  // published row and on its latest version (what the admin edits).
  const block = (publication: string) => sql`
    jsonb_build_object(
      'type', 'block', 'version', 2, 'format', '',
      'fields', jsonb_build_object(
        'id', substr(md5(random()::text), 1, 24),
        'blockName', '', 'blockType', 'cardStack',
        'source', 'publication', 'publication', ${sql.raw(publication)}))`
  await db.execute(sql`
    UPDATE "articles_locales" l
    SET "body" = jsonb_set(l."body", '{root,children}', jsonb_build_array(${block('p.id')}) || (l."body"->'root'->'children'))
    FROM "publications" p
    WHERE p."foreword_id" = l."_parent_id" AND l."body"->'root'->'children' IS NOT NULL;
  `)
  await db.execute(sql`
    UPDATE "_articles_v_locales" l
    SET "version_body" = jsonb_set(l."version_body", '{root,children}', jsonb_build_array(${block('p.id')}) || (l."version_body"->'root'->'children'))
    FROM "_articles_v" v, "publications" p
    WHERE v."id" = l."_parent_id" AND v."latest" AND p."foreword_id" = v."parent_id"
      AND l."version_body"->'root'->'children' IS NOT NULL;
  `)

  await db.execute(sql`
   ALTER TABLE "publications" DROP CONSTRAINT "publications_foreword_id_articles_id_fk";
  
  ALTER TABLE "_publications_v" DROP CONSTRAINT "_publications_v_version_foreword_id_articles_id_fk";
  
  DROP INDEX "publications_foreword_idx";
  DROP INDEX "_publications_v_version_version_foreword_idx";
  ALTER TABLE "publications" DROP COLUMN "foreword_id";
  ALTER TABLE "_publications_v" DROP COLUMN "version_foreword_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "publications" ADD COLUMN "foreword_id" integer;
  ALTER TABLE "_publications_v" ADD COLUMN "version_foreword_id" integer;
  ALTER TABLE "publications" ADD CONSTRAINT "publications_foreword_id_articles_id_fk" FOREIGN KEY ("foreword_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_publications_v" ADD CONSTRAINT "_publications_v_version_foreword_id_articles_id_fk" FOREIGN KEY ("version_foreword_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "publications_foreword_idx" ON "publications" USING btree ("foreword_id");
  CREATE INDEX "_publications_v_version_version_foreword_idx" ON "_publications_v" USING btree ("version_foreword_id");`)
}
