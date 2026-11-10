import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Gives every choice option value that breaks the machine-name rule the
 * value its own text suggests, with the same steps as toQuestionName in
 * src/forms/question-name.ts. A saved answer that is exactly an old value
 * follows it.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION pg_temp.question_name(raw text) RETURNS text LANGUAGE sql AS $f$
      SELECT rtrim(left(CASE WHEN w ~ '^[0-9]' THEN 'q_' || w ELSE w END, 40), '_')
      FROM (SELECT trim(both '_' from regexp_replace(lower(raw), '[^a-z0-9]+', '_', 'g')) AS w) s
    $f$;

    CREATE TEMP TABLE renamed_options (question text, old text, new text) ON COMMIT DROP;

    DO $d$
    DECLARE t text;
    BEGIN
      FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND column_name = 'value'
          AND table_name ~ '^(forms|courses|_courses_v)_blocks_.*_options$'
      LOOP
        EXECUTE format(
          'INSERT INTO renamed_options
           SELECT DISTINCT q.name, o.value, pg_temp.question_name(o.value)
           FROM %I o JOIN %I q ON q.id = o._parent_id
           WHERE o.value !~ ''^[a-z][a-z0-9_]{0,39}$'' AND pg_temp.question_name(o.value) <> '''';
           UPDATE %I SET value = pg_temp.question_name(value)
           WHERE value !~ ''^[a-z][a-z0-9_]{0,39}$'' AND pg_temp.question_name(value) <> ''''',
          t, regexp_replace(t, '_options$', ''), t);
      END LOOP;
    END
    $d$;

    UPDATE form_submissions_submission_data d SET value = r.new
    FROM renamed_options r WHERE d.field = r.question AND d.value = r.old;

    UPDATE form_submissions_choices_answers a SET value = r.new
    FROM renamed_options r WHERE a.name = r.question AND a.value = r.old;
  `)
}

/** The old values broke the rule, so a rollback keeps the new ones. */
export async function down(_: MigrateDownArgs): Promise<void> {}
