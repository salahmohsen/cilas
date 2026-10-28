import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE spaces_search_outbox (
      id bigserial PRIMARY KEY,
      kind text NOT NULL CHECK (kind IN ('post', 'comment', 'thread')),
      source_id integer NOT NULL,
      attempts integer NOT NULL DEFAULT 0,
      available_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX spaces_search_outbox_ready ON spaces_search_outbox (available_at, id);
    CREATE TABLE spaces_search_state (
      id integer PRIMARY KEY CHECK (id = 1),
      generation text,
      writer_token uuid
    );
    INSERT INTO spaces_search_state (id) VALUES (1);
    CREATE TABLE spaces_search_rate (
      key text PRIMARY KEY,
      window_start timestamptz NOT NULL,
      requests integer NOT NULL
    );
  `)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql`DROP TABLE spaces_search_outbox; DROP TABLE spaces_search_rate; DROP TABLE spaces_search_state;`,
  )
}
