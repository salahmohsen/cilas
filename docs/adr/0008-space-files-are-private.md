# Files in spaces are private, not media

Files attached to posts and comments go into their own upload collection, `space-files`, built like `submission-files`: random names, no public URL, served by Payload only to people who can see the space. They do not use `media`, whose files get a public R2 URL that anyone with the link can open. A reading or a draft shared in a closed course would otherwise leak with one forwarded link.

## Consequences

- A file is deleted from storage with its post or comment, and purged with them after 30 days.
- Allowed types and limits reuse `FILE_KINDS` from the application forms (PDF, Word, images; 10 MB; 5 per post, 1 per comment), enforced on the server.
