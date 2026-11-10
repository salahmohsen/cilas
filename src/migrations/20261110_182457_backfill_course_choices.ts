import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TEMP TABLE legacy_course_choices ON COMMIT DROP AS
    SELECT s.id AS submission_id, r.courses_id AS course_id,
      'legacy-course-' || s.id AS choice_id
    FROM form_submissions s
    JOIN form_submissions_rels r ON r.parent_id = s.id AND r.path = 'target'
    WHERE r.courses_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM form_submissions_choices c WHERE c._parent_id = s.id);

    INSERT INTO form_submissions_choices (_order, _parent_id, id, course_id, accepted)
    SELECT 1, submission_id, choice_id, course_id, true FROM legacy_course_choices;

    WITH questions AS (
SELECT q._parent_id AS course_id, q.name, l.label
FROM courses_blocks_checkbox q LEFT JOIN courses_blocks_checkbox_locales l ON l._parent_id = q.id AND l._locale = 'en'
WHERE q._path = 'applicant_questions'
UNION ALL
SELECT q._parent_id AS course_id, q.name, l.label
FROM courses_blocks_checkbox_group q LEFT JOIN courses_blocks_checkbox_group_locales l ON l._parent_id = q.id AND l._locale = 'en'
WHERE q._path = 'applicant_questions'
UNION ALL
SELECT q._parent_id AS course_id, q.name, l.label
FROM courses_blocks_file_upload q LEFT JOIN courses_blocks_file_upload_locales l ON l._parent_id = q.id AND l._locale = 'en'
WHERE q._path = 'applicant_questions'
UNION ALL
SELECT q._parent_id AS course_id, q.name, l.label
FROM courses_blocks_number q LEFT JOIN courses_blocks_number_locales l ON l._parent_id = q.id AND l._locale = 'en'
WHERE q._path = 'applicant_questions'
UNION ALL
SELECT q._parent_id AS course_id, q.name, l.label
FROM courses_blocks_radio q LEFT JOIN courses_blocks_radio_locales l ON l._parent_id = q.id AND l._locale = 'en'
WHERE q._path = 'applicant_questions'
UNION ALL
SELECT q._parent_id AS course_id, q.name, l.label
FROM courses_blocks_select q LEFT JOIN courses_blocks_select_locales l ON l._parent_id = q.id AND l._locale = 'en'
WHERE q._path = 'applicant_questions'
UNION ALL
SELECT q._parent_id AS course_id, q.name, l.label
FROM courses_blocks_text q LEFT JOIN courses_blocks_text_locales l ON l._parent_id = q.id AND l._locale = 'en'
WHERE q._path = 'applicant_questions'
UNION ALL
SELECT q._parent_id AS course_id, q.name, l.label
FROM courses_blocks_textarea q LEFT JOIN courses_blocks_textarea_locales l ON l._parent_id = q.id AND l._locale = 'en'
WHERE q._path = 'applicant_questions'
    )
    INSERT INTO form_submissions_choices_answers (_order, _parent_id, id, name, label, value)
    SELECT a._order, c.choice_id, a.id, substring(a.field FROM 8),
      COALESCE((SELECT q.label FROM questions q
        WHERE q.course_id = c.course_id AND q.name = substring(a.field FROM 8) LIMIT 1),
        substring(a.field FROM 8)), a.value
    FROM form_submissions_submission_data a
    JOIN legacy_course_choices c ON c.submission_id = a._parent_id
    WHERE starts_with(a.field, 'course_');

    DELETE FROM form_submissions_submission_data a
    USING legacy_course_choices c
    WHERE a._parent_id = c.submission_id AND starts_with(a.field, 'course_');
    DROP TABLE legacy_course_choices;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error('Course choice backfill is irreversible: answers now use saved choice snapshots.')
}
