# Files in spaces are private, not media

Files attached to posts and comments go into their own upload collection, `space-files`, built like `submission-files`: random names, no public URL, served by Payload only to people who can see the space. They do not use `media`, whose files get a public R2 URL that anyone with the link can open. A reading or a draft shared in a closed course would otherwise leak with one forwarded link.

## Consequences

- A file is deleted from storage with its post or comment, and purged with them after 30 days.
- Posts take photos only (JPEG, PNG, WebP; 10 MB in; 4 per post), and comments take no files. Each photo is stored as one WebP of at most 1600 px. The `space-files` collection enforces this; see `docs/spaces-media-budget.md`. Files added under the earlier rules (PDF, Word, comment files) stay as they are.
