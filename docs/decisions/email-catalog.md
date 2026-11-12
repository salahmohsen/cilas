# Email catalog

Job: Let an admin see and change the text of every email the system sends, one email at a time, with a preview of that email.

## Decisions and the problems they solve

- One catalog, `src/emails/catalog.ts`: for each email its name, when it goes out, who gets it, its languages, placeholders, versions and default texts. The Email settings fields, their help, the preview and the test send all come from it, and `src/emails/samples.ts` must give sample data for every catalog entry (the type asks for each one).
  - Problem: Defaults, labels, hints and the list of localized emails were four maps that had to change together, and the preview had a fifth list. The two space emails were in none of them.
- The space digest and announcement read their texts from Email settings, in English and Arabic, with Arabic defaults. The digest subject has one field for one item and one for many.
  - Problem: Their text was fixed in `space-mail.tsx`, so an admin could not change it.
- Texts resolve as: saved text in the reader's language, its default in that language, the saved English text, the English default. Payload's own locale fallback is off for this read.
  - Problem: With Payload's fallback, an English change would replace the Arabic default for Arabic readers.
- Each email is a collapsible section in Texts with its placeholders (click to copy), its fields and a preview of the texts as typed, one version at a time, and a test send to the signed-in admin. The preview is `POST /api/email-preview`, admins only.
  - Problem: One page showed four emails at once, and only after saving, so it was hard to see which field changed which line.
- A field with text has a "Use default" button. The default shows in grey in the empty field, in the language being edited.
  - Problem: Once a field has text, its default is hidden, so "clear it to reset" does not show what the reset gives.
- Email settings has no Live Preview URL now; each section has its own preview.
  - Problem: The visual editor turned on "Edit on page" for it, and that never connected.
- "Article review" is now "Review status": it goes out for articles, courses and publications.
- Password reset and review emails stay English only.
