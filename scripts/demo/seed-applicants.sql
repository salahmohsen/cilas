-- Local dev only. Demo applications to review as an admin and as a fellow.
-- Run: docker exec -i -e PGPASSWORD=dev cilas-db-1 psql -U cilas cilas_dev < scripts/demo/seed-applicants.sql
-- Makes sala7.mohsen@gmail.com a fellow of four courses, then adds applications 9100 and up.
-- Safe to run again: it replaces the rows it made. Never run it against production.
BEGIN;

-- The fellow: role on the account, and the person on four courses.
INSERT INTO users_roles ("order", parent_id, value)
SELECT 2, u.id, 'fellow' FROM users u
WHERE u.email = 'sala7.mohsen@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM users_roles r WHERE r.parent_id = u.id AND r.value = 'fellow');
INSERT INTO courses_rels ("order", parent_id, path, people_id)
SELECT 9, c.id, 'fellows', u.person_id
FROM (VALUES (139), (70), (97), (86)) AS c(id), users u
WHERE u.email = 'sala7.mohsen@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM courses_rels r WHERE r.parent_id = c.id AND r.path = 'fellows' AND r.people_id = u.person_id);

-- Courses keep drafts: the admin and the access rules read the latest version, so it gets the fellow too.
INSERT INTO _courses_v_rels ("order", parent_id, path, people_id)
SELECT 9, v.id, 'version.fellows', u.person_id
FROM _courses_v v, users u
WHERE v.latest AND v.parent_id IN (139, 70, 97, 86) AND u.email = 'sala7.mohsen@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM _courses_v_rels r WHERE r.parent_id = v.id AND r.path = 'version.fellows' AND r.people_id = u.person_id);

-- Clean up an earlier run.
DELETE FROM form_submissions WHERE id BETWEEN 9100 AND 9199;

-- name, courses as [course, decision, email_failed], programme (or null), days ago
CREATE TEMP TABLE demo (id int, name text, courses jsonb, programme int, ago int) ON COMMIT DROP;
INSERT INTO demo VALUES
  (9100, 'Nour Hassan',     '[[139,"pending",false]]', NULL, 1),
  (9101, 'Karim Adel',      '[[70,"accepted",false]]', NULL, 6),
  (9102, 'Salma Youssef',   '[[97,"rejected",false]]', NULL, 7),
  (9103, 'Hana Mostafa',    '[[86,"accepted",true]]', NULL, 2),
  (9104, 'Omar Fathy',      '[[139,"accepted",false],[70,"pending",false]]', NULL, 3),
  (9105, 'Dina Samir',      '[[139,"rejected",false],[97,"rejected",false]]', NULL, 8),
  (9106, 'Yara Khaled',     '[[70,"pending",false],[97,"pending",false],[86,"pending",false]]', NULL, 1),
  (9107, 'Tarek Wael',      '[[139,"accepted",false],[70,"rejected",true],[97,"pending",false]]', NULL, 4),
  (9108, 'Mariam Ashraf',   '[[139,"accepted",false],[70,"accepted",false],[97,"accepted",false]]', NULL, 9),
  (9109, 'Ziad Ibrahim',    '[[139,"pending",false],[70,"pending",false],[97,"pending",false],[86,"pending",false]]', NULL, 0),
  (9110, 'Laila Nabil',     '[[139,"rejected",false],[70,"accepted",false],[97,"pending",false],[86,"rejected",false]]', NULL, 5),
  (9111, 'Adam Fouad',      '[[86,"pending",false],[97,"accepted",false]]', NULL, 2),
  (9112, 'Rania Gamal',     '[]', 1, 2),
  (9113, 'Hossam Tawfik',   '[]', 1, 10),
  (9114, 'Farida Lotfy',    '[]', 8, 12),
  (9115, 'Ali Magdy',       '[]', 1, 3);

INSERT INTO form_submissions (id, form_id, status, created_at, updated_at)
SELECT id, 749, 'new', now() - make_interval(days => ago), now() - make_interval(days => ago) FROM demo;

INSERT INTO form_submissions_rels ("order", parent_id, path, courses_id, programmes_id)
SELECT 1, id, 'target',
       CASE WHEN programme IS NULL THEN (courses->0->>0)::int END,
       programme
FROM demo;

INSERT INTO form_submissions_submission_data (_order, _parent_id, id, field, value)
SELECT f.o, d.id, 'sd' || d.id || f.o, f.field,
  CASE f.field
    WHEN 'name' THEN d.name
    WHEN 'email' THEN lower(replace(d.name, ' ', '.')) || '@example.test'
    WHEN 'phone' THEN '+2010000' || d.id
    ELSE 'I want to join because I care about reading closely with others.' END
FROM demo d, (VALUES (1, 'name'), (2, 'email'), (3, 'phone'), (4, 'motivation')) AS f(o, field);

INSERT INTO form_submissions_choices (_order, _parent_id, id, course_id, amount, need_reduction, decision, decided_at, email_failed)
SELECT x.o, d.id, 'ch' || d.id || x.o, (x.c->>0)::int, 100, (x.o = 2),
       (x.c->>1)::enum_form_submissions_choices_decision,
       CASE WHEN x.c->>1 <> 'pending' THEN now() - make_interval(days => greatest(d.ago - 1, 0)) END,
       (x.c->>2)::boolean
FROM demo d, LATERAL jsonb_array_elements(d.courses) WITH ORDINALITY AS x(c, o);

INSERT INTO form_submissions_choices_answers (_order, _parent_id, id, name, label, value)
SELECT 1, c.id, c.id || 'a', 'course_reason', 'What do you want from this course?', 'To read the primary sources.'
FROM form_submissions_choices c WHERE c._parent_id BETWEEN 9100 AND 9199;

-- Programme applications: the decision is the application's.
UPDATE form_submissions SET status = 'accepted', decided_at = now() - interval '9 days' WHERE id = 9113;
UPDATE form_submissions SET status = 'rejected', decided_at = now() - interval '10 days', email_failed = true WHERE id = 9114;

-- Course applications: status and date follow the decisions (forms/application-status.ts).
UPDATE form_submissions s SET
  status = CASE
    WHEN EXISTS (SELECT 1 FROM form_submissions_choices c WHERE c._parent_id = s.id AND c.decision = 'pending') THEN 'new'
    WHEN EXISTS (SELECT 1 FROM form_submissions_choices c WHERE c._parent_id = s.id AND c.decision = 'accepted') THEN 'accepted'
    ELSE 'rejected' END::enum_form_submissions_status,
  decided_at = CASE WHEN EXISTS (SELECT 1 FROM form_submissions_choices c WHERE c._parent_id = s.id AND c.decision = 'pending') THEN NULL
    ELSE (SELECT max(c.decided_at) FROM form_submissions_choices c WHERE c._parent_id = s.id) END
WHERE s.id BETWEEN 9100 AND 9199 AND EXISTS (SELECT 1 FROM form_submissions_choices c WHERE c._parent_id = s.id);

COMMIT;
