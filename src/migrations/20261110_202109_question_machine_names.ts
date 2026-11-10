import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Gives every question name that breaks the machine-name rule the name its
 * own text suggests, with the same steps as toQuestionName in
 * src/forms/question-name.ts. Saved answers under an old name follow it.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE FUNCTION pg_temp.question_name(raw text) RETURNS text LANGUAGE sql AS $f$
      SELECT rtrim(left(CASE WHEN w ~ '^[0-9]' THEN 'q_' || w ELSE w END, 40), '_')
      FROM (SELECT trim(both '_' from regexp_replace(lower(raw), '[^a-z0-9]+', '_', 'g')) AS w) s
    $f$;

    CREATE TEMP TABLE renamed_questions (new text) ON COMMIT DROP;

    DO $d$
    DECLARE t text;
    BEGIN
      FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND column_name = 'name'
          AND (table_name LIKE 'forms\\_blocks\\_%' OR table_name LIKE 'courses\\_blocks\\_%'
            OR table_name LIKE '\\_courses\\_v\\_blocks\\_%')
      LOOP
        EXECUTE format(
          'WITH changed AS (
             UPDATE %I SET name = pg_temp.question_name(name)
             WHERE name !~ ''^[a-z][a-z0-9_]{0,39}$'' AND pg_temp.question_name(name) <> ''''
             RETURNING name)
           INSERT INTO renamed_questions SELECT name FROM changed', t);
      END LOOP;
    END
    $d$;

    UPDATE form_submissions_choices_answers SET name = pg_temp.question_name(name)
    WHERE name !~ '^[a-z][a-z0-9_]{0,39}$'
      AND pg_temp.question_name(name) IN (SELECT new FROM renamed_questions);

    UPDATE form_submissions_submission_data SET field = pg_temp.question_name(field)
    WHERE field !~ '^[a-z][a-z0-9_]{0,39}$'
      AND pg_temp.question_name(field) IN (SELECT new FROM renamed_questions);
  `)
}

/** The old names broke the rule, so a rollback keeps the new ones. */
export async function down(_: MigrateDownArgs): Promise<void> {}
