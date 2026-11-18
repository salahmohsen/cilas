-- Dates are relative to the recording day: registration is open, events are upcoming,
-- and the Buddhist Psychology course meets in the current weeks.
update courses set registration_deadline = now() + interval '10 days' where id between 404 and 411;
update programmes set registration_deadline = now() + interval '14 days' where id = 1;

update events set schedule_mode = 'single',
  schedule_start_date = (current_date + 3) + time '17:00', schedule_end_date = (current_date + 3),
  registration_method = 'external', registration_url = 'http://localhost:3100/en/contact',
  registration_deadline = (current_date + 2) + time '12:00'
where id = 18;
update events set schedule_start_date = (current_date + 17) + time '16:00', schedule_end_date = (current_date + 17),
  registration_method = 'external', registration_url = 'http://localhost:3100/en/contact',
  registration_deadline = (current_date + 16) + time '12:00', cover_image_id = 233
where id = 3;
update events set schedule_start_date = (current_date + 31) + time '15:00', schedule_end_date = (current_date + 31),
  registration_method = 'closed', cover_image_id = (select cover_image_id from courses where id = 405)
where id = 2;

-- Buddhist Psychology (course 175, space 3): its fourth session falls in this week, on the same weekday.
create temp table shift as
select ((current_date - date '2026-05-19') / 7) * 7 + 7 * (extract(isodow from current_date) > 2)::int as days;
update sessions_meetings m set date = to_char(m.date::date + (select days from shift), 'YYYY-MM-DD')
where m._parent_id in (select id from sessions where course_id = 175);
update _sessions_v_version_meetings m set date = to_char(m.date::date + (select days from shift), 'YYYY-MM-DD')
where m._parent_id in (select v.id from _sessions_v v join sessions s on s.id = v.parent_id where s.course_id = 175);
update spaces set reopened = true where id = 3;
update space_posts set event_starts_at = (current_date + 1) + time '16:00', event_ends_at = (current_date + 1) + time '18:00' where id = 13;
update space_posts set event_starts_at = (current_date + 6) + time '15:30', event_ends_at = (current_date + 6) + time '17:30' where id = 14;

-- Test rows that should not appear on camera.
set session_replication_role = replica;
delete from spaces where course_id = 413;
delete from _courses_v where parent_id = 413;
delete from courses where id = 413;
set session_replication_role = origin;
delete from form_submissions where form_id = 21;
delete from space_posts where body like 'test announcement%';
