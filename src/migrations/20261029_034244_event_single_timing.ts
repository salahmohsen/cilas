import { type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

type MigrationArgs = { db: Pick<MigrateUpArgs['db'], 'execute'> }

export async function up({ db }: MigrationArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_events_schedule_mode" AS ENUM('single', 'recurring');
  ALTER TABLE "events_schedule_slots" ALTER COLUMN "weekday" DROP NOT NULL;
  ALTER TABLE "events_schedule_slots" ALTER COLUMN "start_time" DROP NOT NULL;
  ALTER TABLE "events_schedule_slots" ALTER COLUMN "end_time" DROP NOT NULL;
  ALTER TABLE "events" ADD COLUMN "schedule_mode" "enum_events_schedule_mode" DEFAULT 'single';
  ALTER TABLE "events" ADD COLUMN "schedule_start_time" varchar;
  ALTER TABLE "events" ADD COLUMN "schedule_end_time" varchar;

  UPDATE "events" SET "schedule_mode" = 'recurring';

  WITH single_meetings AS (
    SELECT e.id, s.start_time, s.end_time,
      (e.schedule_start_date AT TIME ZONE 'Africa/Cairo')::date +
      ((CASE s.weekday::text
        WHEN 'sun' THEN 0 WHEN 'mon' THEN 1 WHEN 'tue' THEN 2
        WHEN 'wed' THEN 3 WHEN 'thu' THEN 4 WHEN 'fri' THEN 5 WHEN 'sat' THEN 6
      END - EXTRACT(DOW FROM e.schedule_start_date AT TIME ZONE 'Africa/Cairo')::integer + 7) % 7)
      AS meeting_day
    FROM events e JOIN events_schedule_slots s ON s._parent_id = e.id
    WHERE floor(e.schedule_weeks) = 1 AND e.schedule_start_date IS NOT NULL
      AND (e.schedule_start_precision IS NULL OR e.schedule_start_precision = 'day')
      AND (SELECT count(*) FROM events_schedule_slots slots WHERE slots._parent_id = e.id) = 1
      AND s.weekday IS NOT NULL
      AND s.start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND s.end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND s.end_time > s.start_time
  )
  UPDATE events e SET schedule_mode = 'single',
    schedule_start_time = m.start_time, schedule_end_time = m.end_time,
    schedule_start_date = (m.meeting_day + TIME '12:00') AT TIME ZONE 'Africa/Cairo'
  FROM single_meetings m WHERE e.id = m.id;`)
}

export async function down({ db }: MigrationArgs): Promise<void> {
  await db.execute(sql`
  -- Materialize single events as legacy slots, including events created after up.
  DELETE FROM events_schedule_slots s USING events e
    WHERE s._parent_id = e.id AND e.schedule_mode = 'single';
  INSERT INTO events_schedule_slots (_order, _parent_id, id, weekday, start_time, end_time)
    SELECT 1, e.id, md5('single-event-rollback-' || e.id::text),
      (ARRAY['sun','mon','tue','wed','thu','fri','sat'])[
        EXTRACT(DOW FROM e.schedule_start_date AT TIME ZONE 'Africa/Cairo')::integer + 1
      ]::enum_events_schedule_slots_weekday,
      e.schedule_start_time, e.schedule_end_time
    FROM events e WHERE e.schedule_mode = 'single' AND e.schedule_start_date IS NOT NULL
      AND e.schedule_start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND e.schedule_end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND e.schedule_end_time > e.schedule_start_time;
  UPDATE events e SET schedule_weeks = CASE
    WHEN EXISTS (SELECT 1 FROM events_schedule_slots s WHERE s._parent_id = e.id) THEN 1
    ELSE NULL END WHERE e.schedule_mode = 'single';
   ALTER TABLE "events_schedule_slots" ALTER COLUMN "weekday" SET NOT NULL;
  ALTER TABLE "events_schedule_slots" ALTER COLUMN "start_time" SET NOT NULL;
  ALTER TABLE "events_schedule_slots" ALTER COLUMN "end_time" SET NOT NULL;
  ALTER TABLE "events" DROP COLUMN "schedule_mode";
  ALTER TABLE "events" DROP COLUMN "schedule_start_time";
  ALTER TABLE "events" DROP COLUMN "schedule_end_time";
  DROP TYPE "public"."enum_events_schedule_mode";`)
}
