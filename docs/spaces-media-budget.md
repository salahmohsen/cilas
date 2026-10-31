# Spaces media budget

Goal: keep Spaces uploads inside the Cloudflare R2 free tier (10 GB-month
storage, 1M Class A ops, 10M Class B ops, free egress), or at the lowest cost.

## What the code enforces

| Rule                      | Where                                                                    |
| ------------------------- | ------------------------------------------------------------------------ |
| Comments take no files    | no picker, no action path; `space-files` hook refuses a `comment` link   |
| Posts take photos only    | `space-files` `mimeTypes`: JPEG, PNG, WebP                               |
| At most 4 photos per post | `FILE_LIMITS.post`; write layer and `space-files` `beforeValidate` hook  |
| Input at most 10 MB       | `SPACE_FILE_LIMIT`; write layer and `space-files` `beforeOperation` hook |
| One object per photo      | no `imageSizes` on `space-files`                                         |
| Upright, 1600 px, WebP    | `space-files` `resizeOptions` + `formatOptions` (sharp, q80)             |
| EXIF and GPS removed      | sharp drops metadata; `withMetadata` is not set                          |
| Request at most 24 MB     | `UPLOAD_TOTAL_MAX`; Next body limit `28mb`                               |

Why 4 photos: it fills a 2 x 2 grid, and a worst-case post stays under 1 MB.
Five or six would raise that worst case by 25 to 50 % for little gain.

The browser also shrinks each photo before upload (canvas, same 1600 px and
q80, WebP). That saves upload time and request size. The server is the
authority: it re-encodes whatever arrives. `browser-image-compression` was not
added; the canvas code already in `src/lib/image-downscale.ts` does the job.

Event covers are separate `space-files` rows without a post. They pass through
the same sharp step, so a cover is also one WebP of at most 1600 px.

## Measured size

One sample photo (a 4032 x 3024 JPEG, q92, with EXIF and GPS tags, made from
the classroom photo plus sensor-like noise, so it is heavier than most real
photos), uploaded through the composer in a real run:

| Stage                 | Size        | Pixels      |
| --------------------- | ----------- | ----------- |
| Input (JPEG)          | 2,487,493 B | 4032 x 3024 |
| Stored (WebP, R2 row) | 227,770 B   | 1600 x 1200 |

That is 91 % smaller. Use 0.23 MB per photo as a cautious figure.

## Cost model

Storage (the limit that binds first):

- Full post (4 photos): about 0.91 MB.
- Average post (2 photos): about 0.46 MB.
- 10 GB holds about 11,000 full posts, or about 22,000 average posts, if
  Spaces had the whole bucket. `media` and applications share the same 10 GB;
  check the bucket's current size before counting on all of it.

Operations per upload (the S3 adapter sends one `PutObject` under 50 MB):

- Class A: 1 per photo, so 4 per full post. 1M Class A is about 250,000 full
  posts a month. Not a limit.
- `DeleteObject` is free. Deleting a post deletes its photos.

Operations per view:

- `space-files` is private (ADR 0008). Reads go through Payload and the Next
  server (`/api/space-files/file/...`), which checks the reader and then calls
  `HeadObject` and `GetObject`: 2 Class B per photo per uncached view, and the
  bytes cross the Next server.
- The file name is random and never rewritten, so responses now carry
  `Cache-Control: private, max-age=31536000, immutable`. A browser that has
  seen a photo asks for it again 0 times. 10M Class B is about 5M uncached photo
  views a month. Not a limit.
- `media` (public, admin-uploaded) is served straight from `R2_PUBLIC_URL`, not
  through Next: 1 Class B per uncached request, no server bandwidth. The S3
  adapter sets no `Cache-Control` on upload, so cache lifetime there comes from
  the R2 custom domain or a Cloudflare Cache Rule. Set one rule on the public
  domain for `/media/*`: cache `1 year`. This is a dashboard step, not code.

Signed URLs (`signedDownloads`) would cut the proxied read to 1 Class B and
remove server bandwidth, but each link is unique and valid for 2 hours: it
cannot be cached, and a copied link works for anyone until it expires. For a
private collection that trade is worse than the immutable cache, so it is not
enabled.

## Levers left

1. **Old comment attachments.** Nothing deletes them. Rows in `space_files`
   with `comment_id` set are still stored and no longer shown. To reclaim the
   space: list them (`where: { comment: { exists: true } }`), check the total
   `filesize`, then delete each with `payload.delete({ collection:
   'space-files', id, overrideAccess: true })`, which also removes the R2 object.
   Do it in a one-off script, with a dry run first. Deleting a comment already
   deletes its files.
2. **Orphan cleanup.** A failed save removes its staged files, so orphans are
   rare. A `space-files` row with no `post`, no `comment`, and no post whose
   `event_cover` points at it, older than a day, is an orphan. Run the same
   delete loop on those rows monthly (a Dokploy schedule or a Payload job).
3. **Per-user quota.** Add a `beforeValidate` check on `space-files` that sums
   `filesize` for the uploader's person in the last 30 days and refuses past a
   cap (for example 50 MB). It needs an `uploader` field, so it needs a
   migration; not done here.
4. **Re-encode older files.** Photos stored before this change can be up to
   2560 px and about 3 MB. A one-off job can read each, re-encode it with the
   same sharp options, and overwrite it. Older PDF and Word files on posts stay
   as they are.
5. **Lower the knobs.** `IMAGE_EDGE` 1280 and quality 75 should cut a photo by about a
   third (estimate, not measured). Change them in `src/lib/space-file-limits.ts`; browser and server
   follow.
