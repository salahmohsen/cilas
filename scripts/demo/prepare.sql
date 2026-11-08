-- Dates are relative to the recording day: keep registration open and events upcoming.
update courses set registration_deadline='2026-11-15 12:00:00+00' where id in (404,405,406,407,408,409,410,411);
update programmes set registration_deadline='2026-11-29 12:00:00+00' where id=1;
update events set schedule_mode='single', schedule_start_date='2026-11-21 16:00:00+00', schedule_end_date='2026-11-21 00:00:00+00', registration_method='external', registration_url='http://localhost:3000/en/contact', registration_deadline='2026-11-20 12:00:00+00' where id=18;
update events set schedule_start_date='2026-12-05 16:00:00+00', schedule_end_date='2026-12-05 00:00:00+00', registration_method='external', registration_url='http://localhost:3000/en/contact', registration_deadline='2026-12-04 12:00:00+00' where id=3;
update spaces set reopened=true where id=3;
update space_posts set event_starts_at='2026-11-14 16:00:00+00', event_ends_at='2026-11-14 18:00:00+00' where id=13;
update space_posts set event_starts_at='2026-11-18 16:00:00+00', event_ends_at='2026-11-18 18:00:00+00' where id=14;
-- Test rows that should not appear on camera.
set session_replication_role = replica;
delete from spaces where course_id = 413;
delete from _courses_v where parent_id = 413;
delete from courses where id = 413;
set session_replication_role = origin;
delete from form_submissions where form_id = 21;
delete from space_posts where body like 'test announcement%';
-- Three upcoming events with covers from the media library, so the carousel fills the frame.
update events set schedule_start_date='2026-11-14 16:00:00+00', schedule_end_date='2026-11-14 00:00:00+00', registration_deadline='2026-11-13 12:00:00+00', cover_image_id=233 where id=3;
update events set schedule_start_date='2026-12-19 15:00:00+00', schedule_end_date='2026-12-19 00:00:00+00', registration_method='closed', cover_image_id=(select cover_image_id from courses where id=405) where id=2;
