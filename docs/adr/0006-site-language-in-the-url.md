# The site language is part of every public URL

Every public page lives under its site language: `/en/...` and `/ar/...`, both always prefixed. A bare path redirects to the visitor's saved choice, then their browser's language, then English. Payload's `/admin` and `/api` stay outside this.

Each language then has its own address to share, cache and index (with `hreflang`). The server knows the language and direction before rendering, so Arabic pages never flash from left-to-right. We rejected leaving English unprefixed: it saves a segment, but the two languages would be handled differently. We also rejected a cookie with one URL for both languages, because a page would no longer have one cacheable, indexable version.

A piece with no text in the site language is shown in its content language at the same URL, with a notice. It does not redirect to the other site language, so the rest of the page stays in the reader's language. Links and redirects carry the language: `pathOf` takes it, and a legacy redirect lands on the visitor's language.
