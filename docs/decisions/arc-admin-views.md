# Arc admin views

Job: Give every custom admin view (Applicants, Reviews, Subscribers, AI access) one frame, Arc components, and English and Arabic text.

## Decisions and the problems they solve

- One `ArcAdminView` frame (`src/components/admin/arc-admin-view.tsx`): Payload's template, the scoped Arc tokens, `dir` and `lang`, one heading, and a required `allowed` flag. The content renders only when `allowed` is true, and data loads inside an async child, so it never runs for other users.
  - Problem: Each view copied the template, the Arc scope and the page styles, and the copies were already different.
  - Problem: Payload's access rules do not protect custom views, and each view had to remember its own check.
- `adminLanguage(req)` is the one rule for the admin's language. A view that is in English only (AI access) passes `"en"`.
  - Problem: Each view read `req.i18n.language` in its own way.
- The review queue returns data, not English text: `title` is null when there is none, and `removal` is a flag. `reviews-copy.ts` writes the text in the reader's language.
  - Problem: `src/lib/review-queue.ts` built "Untitled article" and "Remove from the site: …" in English, so the page could not be translated.
- One `ReviewsTable` for the Reviews page and the dashboard box.
  - Problem: Two places showed the same queue and had to change together.
- One `ContactsMeter` and one `CONTACT_WARN_AT` for the dashboard widget and the Subscribers page.
  - Problem: The widget and the page drew the contact limit in two ways, with two copies of the 90% warning share.
- One `isolate` helper in `src/lib/bidi.ts` for names and titles inside text of the other direction.
  - Problem: Each copy file had its own copy of the helper.
- Mailing lists stay links (`?list=`), not tabs: each list has its own URL.
