import { randomBytes } from 'node:crypto'

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

type Row = Record<string, unknown>
type Db = MigrateUpArgs['db']

const nodeId = () => randomBytes(12).toString('hex')

const block = (fields: Row) => ({
  type: 'block',
  version: 2,
  format: '',
  fields: { id: nodeId(), blockName: '', ...fields },
})

const PICK_KEYS = ['course', 'article', 'publication', 'cycle', 'event', 'programme']

const pickOf = (row: Row) => ({
  id: nodeId(),
  type: row.type,
  note: row.note,
  ...Object.fromEntries(PICK_KEYS.flatMap((k) => (row[`${k}_id`] ? [[k, row[`${k}_id`]]] : []))),
})

const groupBy = (rows: Row[], key: string) => {
  const groups = new Map<unknown, Row[]>()
  for (const row of rows) groups.set(row[key], [...(groups.get(row[key]) ?? []), row])
  return groups
}

const childrenOf = (body: unknown): unknown[] =>
  ((body as { root?: { children?: unknown[] } } | null)?.root?.children ?? []) as unknown[]

/** One section per issue: the old intro, then each old block in its order. */
async function moveToSections(
  db: Db,
  t: {
    parents: string
    locales: string
    bodyColumn: string
    blocksPrefix: string
    sections: string
    idColumn: 'id' | '_uuid'
  },
) {
  const all = async (query: string) => (await db.execute(sql.raw(query))).rows as Row[]
  const blocks = (name: string) => all(`select * from "${t.blocksPrefix}${name}" order by "_order"`)
  const [parents, intros, text, image, gallery, galleryImages, quote, picks, pickItems] =
    await Promise.all([
      all(`select id from "${t.parents}"`),
      all(`select "_parent_id", "${t.bodyColumn}" as body from "${t.locales}" where "_locale" = 'en'`),
      blocks('text'),
      blocks('image'),
      blocks('gallery'),
      blocks('gallery_images'),
      blocks('quote'),
      blocks('picks'),
      blocks('picks_items'),
    ])
  const introOf = new Map(intros.map((row) => [row._parent_id, row.body]))
  const rowsOfGallery = groupBy(galleryImages, '_parent_id')
  const itemsOfPicks = groupBy(pickItems, '_parent_id')
  const tagged = [
    ...text.map((row) => ({ row, nodes: childrenOf(row.body) })),
    ...image.map((row) => ({
      row,
      nodes: [
        block({ blockType: 'newsletterImage', image: row.image_id, caption: row.caption }),
        ...childrenOf(row.body),
      ],
    })),
    ...gallery.map((row) => ({
      row,
      nodes: [
        block({
          blockType: 'gallery',
          columnCount: String(row.columns ?? '2'),
          images: (rowsOfGallery.get(row.id) ?? []).map((i) => ({
            id: nodeId(),
            image: i.image_id,
            caption: i.caption,
          })),
        }),
      ],
    })),
    ...quote.map((row) => ({
      row,
      nodes: [block({ blockType: 'newsletterQuote', text: row.text, attribution: row.attribution })],
    })),
    ...picks.map((row) => ({
      row,
      nodes: [
        block({
          blockType: 'newsletterPicks',
          heading: row.heading,
          items: (itemsOfPicks.get(row.id) ?? []).map(pickOf),
        }),
      ],
    })),
  ]
  const byParent = new Map<unknown, typeof tagged>()
  for (const item of tagged) {
    byParent.set(item.row._parent_id, [...(byParent.get(item.row._parent_id) ?? []), item])
  }
  for (const { id } of parents) {
    const ordered = (byParent.get(id) ?? []).sort(
      (a, b) => Number(a.row._order) - Number(b.row._order),
    )
    const children = [...childrenOf(introOf.get(id)), ...ordered.flatMap((item) => item.nodes)]
    const body = JSON.stringify({
      root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children },
    })
    await db.execute(
      sql`insert into ${sql.identifier(t.sections)} ("_order", "_parent_id", ${sql.identifier(t.idColumn)}, "body")
          values (1, ${id}, ${nodeId()}, ${body}::jsonb)`,
    )
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "newsletters_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"body" jsonb
  );
  
  CREATE TABLE "_newsletters_v_version_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"body" jsonb,
  	"_uuid" varchar
  );
  
    ALTER TABLE "newsletters_sections" ADD CONSTRAINT "newsletters_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_version_sections" ADD CONSTRAINT "_newsletters_v_version_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "newsletters_sections_order_idx" ON "newsletters_sections" USING btree ("_order");
  CREATE INDEX "newsletters_sections_parent_id_idx" ON "newsletters_sections" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_version_sections_order_idx" ON "_newsletters_v_version_sections" USING btree ("_order");
  CREATE INDEX "_newsletters_v_version_sections_parent_id_idx" ON "_newsletters_v_version_sections" USING btree ("_parent_id");`)

  await moveToSections(db, {
    parents: 'newsletters',
    locales: 'newsletters_locales',
    bodyColumn: 'body',
    blocksPrefix: 'newsletters_blocks_',
    sections: 'newsletters_sections',
    idColumn: 'id',
  })
  await moveToSections(db, {
    parents: '_newsletters_v',
    locales: '_newsletters_v_locales',
    bodyColumn: 'version_body',
    blocksPrefix: '_newsletters_v_blocks_',
    sections: '_newsletters_v_version_sections',
    idColumn: '_uuid',
  })

  await db.execute(sql`  ALTER TABLE "newsletters_blocks_picks_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_picks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_image" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_gallery_images" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_quote" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_picks_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_picks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_image" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_gallery_images" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_quote" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_text" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "newsletters_blocks_picks_items" CASCADE;
  DROP TABLE "newsletters_blocks_picks" CASCADE;
  DROP TABLE "newsletters_blocks_image" CASCADE;
  DROP TABLE "newsletters_blocks_gallery_images" CASCADE;
  DROP TABLE "newsletters_blocks_gallery" CASCADE;
  DROP TABLE "newsletters_blocks_quote" CASCADE;
  DROP TABLE "newsletters_blocks_text" CASCADE;
  DROP TABLE "_newsletters_v_blocks_picks_items" CASCADE;
  DROP TABLE "_newsletters_v_blocks_picks" CASCADE;
  DROP TABLE "_newsletters_v_blocks_image" CASCADE;
  DROP TABLE "_newsletters_v_blocks_gallery_images" CASCADE;
  DROP TABLE "_newsletters_v_blocks_gallery" CASCADE;
  DROP TABLE "_newsletters_v_blocks_quote" CASCADE;
  DROP TABLE "_newsletters_v_blocks_text" CASCADE;
  ALTER TABLE "newsletters" ALTER COLUMN "cover_caption" SET DATA TYPE jsonb USING CASE WHEN "cover_caption" IS NULL OR "cover_caption" = '' THEN NULL ELSE jsonb_build_object('root', jsonb_build_object('type', 'root', 'format', '', 'indent', 0, 'version', 1, 'direction', 'ltr', 'children', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'format', '', 'indent', 0, 'version', 1, 'direction', 'ltr', 'textFormat', 0, 'textStyle', '', 'children', jsonb_build_array(jsonb_build_object('type', 'text', 'text', "cover_caption", 'format', 0, 'detail', 0, 'mode', 'normal', 'style', '', 'version', 1)))))) END;
  ALTER TABLE "_newsletters_v" ALTER COLUMN "version_cover_caption" SET DATA TYPE jsonb USING CASE WHEN "version_cover_caption" IS NULL OR "version_cover_caption" = '' THEN NULL ELSE jsonb_build_object('root', jsonb_build_object('type', 'root', 'format', '', 'indent', 0, 'version', 1, 'direction', 'ltr', 'children', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'format', '', 'indent', 0, 'version', 1, 'direction', 'ltr', 'textFormat', 0, 'textStyle', '', 'children', jsonb_build_array(jsonb_build_object('type', 'text', 'text', "version_cover_caption", 'format', 0, 'detail', 0, 'mode', 'normal', 'style', '', 'version', 1)))))) END;
  ALTER TABLE "newsletters_locales" DROP COLUMN "body";
  ALTER TABLE "_newsletters_v_locales" DROP COLUMN "version_body";
  DROP TYPE "public"."enum_newsletters_blocks_picks_items_type";
  DROP TYPE "public"."enum_newsletters_blocks_gallery_columns";
  DROP TYPE "public"."enum__newsletters_v_blocks_picks_items_type";
  DROP TYPE "public"."enum__newsletters_v_blocks_gallery_columns";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_newsletters_blocks_picks_items_type" AS ENUM('course', 'article', 'publication', 'cycle', 'event', 'programme');
  CREATE TYPE "public"."enum_newsletters_blocks_gallery_columns" AS ENUM('2', '3');
  CREATE TYPE "public"."enum__newsletters_v_blocks_picks_items_type" AS ENUM('course', 'article', 'publication', 'cycle', 'event', 'programme');
  CREATE TYPE "public"."enum__newsletters_v_blocks_gallery_columns" AS ENUM('2', '3');
  CREATE TABLE "newsletters_blocks_picks_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_newsletters_blocks_picks_items_type" DEFAULT 'course',
  	"course_id" integer,
  	"article_id" integer,
  	"publication_id" integer,
  	"cycle_id" integer,
  	"event_id" integer,
  	"programme_id" integer,
  	"note" varchar
  );
  
  CREATE TABLE "newsletters_blocks_picks" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "newsletters_blocks_image" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar,
  	"body" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "newsletters_blocks_gallery_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar
  );
  
  CREATE TABLE "newsletters_blocks_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"columns" "enum_newsletters_blocks_gallery_columns" DEFAULT '2',
  	"block_name" varchar
  );
  
  CREATE TABLE "newsletters_blocks_quote" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"attribution" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "newsletters_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"body" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_picks_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum__newsletters_v_blocks_picks_items_type" DEFAULT 'course',
  	"course_id" integer,
  	"article_id" integer,
  	"publication_id" integer,
  	"cycle_id" integer,
  	"event_id" integer,
  	"programme_id" integer,
  	"note" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_picks" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_image" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar,
  	"body" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_gallery_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"columns" "enum__newsletters_v_blocks_gallery_columns" DEFAULT '2',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_quote" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"attribution" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"body" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "newsletters_sections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_version_sections" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "newsletters_sections" CASCADE;
  DROP TABLE "_newsletters_v_version_sections" CASCADE;
  ALTER TABLE "newsletters" ALTER COLUMN "cover_caption" SET DATA TYPE varchar USING "cover_caption"#>>'{root,children,0,children,0,text}';
  ALTER TABLE "_newsletters_v" ALTER COLUMN "version_cover_caption" SET DATA TYPE varchar USING "version_cover_caption"#>>'{root,children,0,children,0,text}';
  ALTER TABLE "newsletters_locales" ADD COLUMN "body" jsonb;
  ALTER TABLE "_newsletters_v_locales" ADD COLUMN "version_body" jsonb;
  ALTER TABLE "newsletters_blocks_picks_items" ADD CONSTRAINT "newsletters_blocks_picks_items_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_picks_items" ADD CONSTRAINT "newsletters_blocks_picks_items_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_picks_items" ADD CONSTRAINT "newsletters_blocks_picks_items_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_picks_items" ADD CONSTRAINT "newsletters_blocks_picks_items_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_picks_items" ADD CONSTRAINT "newsletters_blocks_picks_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_picks_items" ADD CONSTRAINT "newsletters_blocks_picks_items_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_picks_items" ADD CONSTRAINT "newsletters_blocks_picks_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters_blocks_picks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_picks" ADD CONSTRAINT "newsletters_blocks_picks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_image" ADD CONSTRAINT "newsletters_blocks_image_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_image" ADD CONSTRAINT "newsletters_blocks_image_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_gallery_images" ADD CONSTRAINT "newsletters_blocks_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_gallery_images" ADD CONSTRAINT "newsletters_blocks_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters_blocks_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_gallery" ADD CONSTRAINT "newsletters_blocks_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_quote" ADD CONSTRAINT "newsletters_blocks_quote_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_text" ADD CONSTRAINT "newsletters_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD CONSTRAINT "_newsletters_v_blocks_picks_items_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD CONSTRAINT "_newsletters_v_blocks_picks_items_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD CONSTRAINT "_newsletters_v_blocks_picks_items_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD CONSTRAINT "_newsletters_v_blocks_picks_items_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD CONSTRAINT "_newsletters_v_blocks_picks_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD CONSTRAINT "_newsletters_v_blocks_picks_items_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD CONSTRAINT "_newsletters_v_blocks_picks_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v_blocks_picks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_picks" ADD CONSTRAINT "_newsletters_v_blocks_picks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_image" ADD CONSTRAINT "_newsletters_v_blocks_image_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_image" ADD CONSTRAINT "_newsletters_v_blocks_image_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_gallery_images" ADD CONSTRAINT "_newsletters_v_blocks_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_gallery_images" ADD CONSTRAINT "_newsletters_v_blocks_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v_blocks_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_gallery" ADD CONSTRAINT "_newsletters_v_blocks_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_quote" ADD CONSTRAINT "_newsletters_v_blocks_quote_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_text" ADD CONSTRAINT "_newsletters_v_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "newsletters_blocks_picks_items_order_idx" ON "newsletters_blocks_picks_items" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_picks_items_parent_id_idx" ON "newsletters_blocks_picks_items" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_picks_items_course_idx" ON "newsletters_blocks_picks_items" USING btree ("course_id");
  CREATE INDEX "newsletters_blocks_picks_items_article_idx" ON "newsletters_blocks_picks_items" USING btree ("article_id");
  CREATE INDEX "newsletters_blocks_picks_items_publication_idx" ON "newsletters_blocks_picks_items" USING btree ("publication_id");
  CREATE INDEX "newsletters_blocks_picks_items_cycle_idx" ON "newsletters_blocks_picks_items" USING btree ("cycle_id");
  CREATE INDEX "newsletters_blocks_picks_items_event_idx" ON "newsletters_blocks_picks_items" USING btree ("event_id");
  CREATE INDEX "newsletters_blocks_picks_items_programme_idx" ON "newsletters_blocks_picks_items" USING btree ("programme_id");
  CREATE INDEX "newsletters_blocks_picks_order_idx" ON "newsletters_blocks_picks" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_picks_parent_id_idx" ON "newsletters_blocks_picks" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_picks_path_idx" ON "newsletters_blocks_picks" USING btree ("_path");
  CREATE INDEX "newsletters_blocks_image_order_idx" ON "newsletters_blocks_image" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_image_parent_id_idx" ON "newsletters_blocks_image" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_image_path_idx" ON "newsletters_blocks_image" USING btree ("_path");
  CREATE INDEX "newsletters_blocks_image_image_idx" ON "newsletters_blocks_image" USING btree ("image_id");
  CREATE INDEX "newsletters_blocks_gallery_images_order_idx" ON "newsletters_blocks_gallery_images" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_gallery_images_parent_id_idx" ON "newsletters_blocks_gallery_images" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_gallery_images_image_idx" ON "newsletters_blocks_gallery_images" USING btree ("image_id");
  CREATE INDEX "newsletters_blocks_gallery_order_idx" ON "newsletters_blocks_gallery" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_gallery_parent_id_idx" ON "newsletters_blocks_gallery" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_gallery_path_idx" ON "newsletters_blocks_gallery" USING btree ("_path");
  CREATE INDEX "newsletters_blocks_quote_order_idx" ON "newsletters_blocks_quote" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_quote_parent_id_idx" ON "newsletters_blocks_quote" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_quote_path_idx" ON "newsletters_blocks_quote" USING btree ("_path");
  CREATE INDEX "newsletters_blocks_text_order_idx" ON "newsletters_blocks_text" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_text_parent_id_idx" ON "newsletters_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_text_path_idx" ON "newsletters_blocks_text" USING btree ("_path");
  CREATE INDEX "_newsletters_v_blocks_picks_items_order_idx" ON "_newsletters_v_blocks_picks_items" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_picks_items_parent_id_idx" ON "_newsletters_v_blocks_picks_items" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_picks_items_course_idx" ON "_newsletters_v_blocks_picks_items" USING btree ("course_id");
  CREATE INDEX "_newsletters_v_blocks_picks_items_article_idx" ON "_newsletters_v_blocks_picks_items" USING btree ("article_id");
  CREATE INDEX "_newsletters_v_blocks_picks_items_publication_idx" ON "_newsletters_v_blocks_picks_items" USING btree ("publication_id");
  CREATE INDEX "_newsletters_v_blocks_picks_items_cycle_idx" ON "_newsletters_v_blocks_picks_items" USING btree ("cycle_id");
  CREATE INDEX "_newsletters_v_blocks_picks_items_event_idx" ON "_newsletters_v_blocks_picks_items" USING btree ("event_id");
  CREATE INDEX "_newsletters_v_blocks_picks_items_programme_idx" ON "_newsletters_v_blocks_picks_items" USING btree ("programme_id");
  CREATE INDEX "_newsletters_v_blocks_picks_order_idx" ON "_newsletters_v_blocks_picks" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_picks_parent_id_idx" ON "_newsletters_v_blocks_picks" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_picks_path_idx" ON "_newsletters_v_blocks_picks" USING btree ("_path");
  CREATE INDEX "_newsletters_v_blocks_image_order_idx" ON "_newsletters_v_blocks_image" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_image_parent_id_idx" ON "_newsletters_v_blocks_image" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_image_path_idx" ON "_newsletters_v_blocks_image" USING btree ("_path");
  CREATE INDEX "_newsletters_v_blocks_image_image_idx" ON "_newsletters_v_blocks_image" USING btree ("image_id");
  CREATE INDEX "_newsletters_v_blocks_gallery_images_order_idx" ON "_newsletters_v_blocks_gallery_images" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_gallery_images_parent_id_idx" ON "_newsletters_v_blocks_gallery_images" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_gallery_images_image_idx" ON "_newsletters_v_blocks_gallery_images" USING btree ("image_id");
  CREATE INDEX "_newsletters_v_blocks_gallery_order_idx" ON "_newsletters_v_blocks_gallery" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_gallery_parent_id_idx" ON "_newsletters_v_blocks_gallery" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_gallery_path_idx" ON "_newsletters_v_blocks_gallery" USING btree ("_path");
  CREATE INDEX "_newsletters_v_blocks_quote_order_idx" ON "_newsletters_v_blocks_quote" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_quote_parent_id_idx" ON "_newsletters_v_blocks_quote" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_quote_path_idx" ON "_newsletters_v_blocks_quote" USING btree ("_path");
  CREATE INDEX "_newsletters_v_blocks_text_order_idx" ON "_newsletters_v_blocks_text" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_text_parent_id_idx" ON "_newsletters_v_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_text_path_idx" ON "_newsletters_v_blocks_text" USING btree ("_path");`)
}
