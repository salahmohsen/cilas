# Card grid layout: design

Date: 2026-10-21
Status: approved

## Goal

An admin writes an article that announces a new cycle and its courses. In the
article text, the admin adds a grid of course cards: all the courses of one
cycle, or courses that the admin chooses.

The Card stack block (`src/blocks/card-stack.ts`) already has these sources,
and `resolveCardStacks` (`src/api/card-stacks.api.ts`) already reads them as
the reader may. The new part is a second layout: the Arc blog grid, which the
Open for registration page and the Bridge page already use for courses.

## Decisions

| Question             | Decision                                                                            |
| -------------------- | ----------------------------------------------------------------------------------- |
| New block or option? | An option: `layout` on the Card stack block. No second block with the same sources. |
| Grid parts           | Course cards, with tabs by course type. No featured card, no pagination.            |
| Sources for the grid | All four sources. Tabs only for course sources.                                     |
| Migration            | None. The block is JSON in the Lexical body.                                        |

## Admin

`src/blocks/card-stack.ts`:

- New field `layout`: select, required, options `stack` (“Stack”) and `grid`
  (“Grid”), default `stack`. Articles from before keep the stack.
- Block labels become “Cards (stack or grid)” / “Cards”, so an admin who looks
  for a grid finds it. The slug stays `cardStack` and `interfaceName` stays
  `CardStackBlock`.
- The source fields and `label` do not change.
- Run `pnpm generate:types` after the change.

## Data

`src/api/card-stacks.api.ts`:

- `ResolvedStack` becomes `{ label, layout, items, posts, categories }`:
  - `layout`: `'stack' | 'grid'`, from the block, `stack` when empty.
  - `items`: the stack cards, as now.
  - `posts`: `BlogPost[]` for the grid, filled only when `layout === 'grid'`.
  - `categories`: the names of the course types in the grid (BlogGrid matches
    a tab to `post.category`), in `COURSE_TYPE_OPTIONS`
    order. Empty when the grid has fewer than 2 types, or for article sources.
- A course post: `id` = slug, `title`, `excerpt` = summary or subtitle,
  `category` and `label` = the course type's name in the
  reader's language (`Study.filters.types`), cover image, `author` = the fellows' names (one `BlogAuthor`, as `courseItem` joins them),
  `href` as the course page. No date and no read time on the card (empty labels).
- An article post: the same fields that `ArticlesGrid` cards use now
  (`src/lib/article-cards.ts`), no categories.
- Access and order do not change: only published, public courses; only
  published articles the reader can open; the open article is left out;
  chosen sources keep the chosen order, a cycle's courses go by title.
- A block with no cards gives no entry, as now.

## Display

- New client component `src/components/article/article-card-grid.tsx`. It
  wraps `BlogGrid` the same way `src/components/open-grid.tsx` does: `flush`,
  `header={false}`, `order="given"`, `showFeatured={false}`,
  `pageSize={posts.length}`, `getHref` from the post's `href`, labels from
  `Articles.grid`. The block `label` names the grid for screen readers
  (`aria-label` on the wrapper section).
- Tabs show only when `categories` has 2 or more entries. The tab text is the
  course type's name; the “All” tab comes first.
- A course without a cover shows its cycle's season mark, the same as
  `bridge-courses.tsx` does.
- `src/components/article/article-page.tsx`: the `cardStack` renderer shows
  `ArticleCardGrid` when `layout === 'grid'`, else `ArticleCardStack`.
- The grid stays in the article column. It does not go wider than the text.

## Tests

- Vitest for `resolveCardStacks`:
  - Grid with a cycle source gives `posts` for each published public course, in title order.
  - Grid with chosen courses keeps the chosen order.
  - Courses of 2 types give 2 categories in `COURSE_TYPE_OPTIONS` order; 1 type gives none.
  - A block with no `layout` resolves as `stack`, with no `posts`.
- Manual check in the browser: one announcement article with a cycle grid, in
  English and Arabic (RTL), on a wide screen and a phone.

## Out of scope

A featured card, a grid title in the page, filters other than course type,
pagination, and a sort option.
