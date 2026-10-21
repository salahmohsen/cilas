# Card Grid Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Card stack block in an article gets a `layout` option, and `grid` shows its cards (for example a cycle's courses) as the Arc blog grid with tabs by course type.

**Architecture:** The block config gets one select field. `resolveCardStacks` keeps its sources and access rules, and also returns grid posts, course-type tabs and seasons. A new client component wraps `BlogGrid`, and the article page picks the stack or the grid for each block.

**Tech Stack:** Payload CMS 3 (Lexical blocks), Next.js App Router, next-intl, Vitest, Arc `BlogGrid`.

Spec: `docs/superpowers/specs/2026-10-21-card-grid-layout-design.md`. Work on `main` (project rule). No DB migration: the block is JSON inside the Lexical body.

---

## File map

| File | Change |
| --- | --- |
| `src/blocks/card-stack.ts` | `layout` field, new labels |
| `src/payload-types.ts` | generated |
| `src/api/card-stacks.api.ts` | `ResolvedStack` gets `layout`, `posts`, `categories`, `seasons`; new options `articleCard`, `labels.courseType` |
| `tests/unit/card-stacks.unit.spec.ts` | grid tests, existing test updated for the new shape |
| `messages/en.json`, `messages/ar.json` | `Article.gridFilterBy` |
| `src/components/article/article-card-grid.tsx` | new: `BlogGrid` for a block |
| `src/components/article/article-page.tsx` | pass the new options; render the grid |

---

### Task 1: The `layout` field on the block

**Files:**
- Modify: `src/blocks/card-stack.ts`
- Modify (generated): `src/payload-types.ts`

- [ ] **Step 1: Change the doc comment and the labels, and add the field**

In `src/blocks/card-stack.ts`, replace the top of the file down to `fields: [` with:

```ts
import type { Block } from 'payload'

/**
 * Cards inside an article's text: an article collection's articles, chosen
 * articles or courses, or a cycle's courses. As a stack, the orbit card fan
 * (a list on phones); as a grid, Arc's blog grid with tabs by course type.
 * The site shows only published, public items.
 */
export const CardStack: Block = {
  slug: 'cardStack',
  interfaceName: 'CardStackBlock',
  labels: { singular: 'Cards (stack or grid)', plural: 'Cards' },
  fields: [
    {
      name: 'layout',
      type: 'select',
      required: true,
      defaultValue: 'stack',
      options: [
        { label: 'Stack', value: 'stack' },
        { label: 'Grid', value: 'grid' },
      ],
      admin: { description: 'Grid: for announcing a cycle or several courses.' },
    },
```

Keep every other field (`source`, `publication`, `articles`, `courses`, `cycle`, `label`) as it is.

- [ ] **Step 2: Make the types again**

Run: `pnpm generate:types`
Expected: it ends with no error, and `git diff src/payload-types.ts` shows `layout: 'stack' | 'grid';` in `CardStackBlock`.

- [ ] **Step 3: Commit**

```bash
git add src/blocks/card-stack.ts src/payload-types.ts
git commit -m "feat(articles): a Card stack block can be a stack or a grid

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The resolver gives grid posts and tabs

**Files:**
- Modify: `src/api/card-stacks.api.ts`
- Test: `tests/unit/card-stacks.unit.spec.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/unit/card-stacks.unit.spec.ts`:

Replace the `courses` fixture with:

```ts
const courses = [
  { id: 10, title: 'Plato', slug: 'plato', course_type: 'CORE', fellows: [{ name: 'Mona' }], summary: 'Book by book.', cycle: { title: 'Fall 2026, Cairo', season: 'fall' } },
  { id: 11, title: 'Archives', slug: 'archives', course_type: 'WORKSHOP', fellows: [], subtitle: 'Reading the files.', cycle: { title: 'Fall 2026, Cairo', season: 'fall' }, cover_image: { url: '/media/a.jpg', alt: 'Files' } },
]
```

Replace the `find` mock so a course `id in` filter is used (the old mock returned all courses for every query):

```ts
  find: vi.fn(async ({ collection, where }: { collection: string; where: { and: Array<Record<string, { in?: number[] }>> } }) => {
    const ids = where.and[0]!.id?.in
    if (collection === 'articles') return { docs: articles.filter((a) => ids!.includes(a.id)) }
    return { docs: ids ? courses.filter((c) => ids.includes(c.id)) : courses }
  }),
```

In `options`, add `articleCard` and `labels.courseType`:

```ts
  articleCard: (a: { id: number; title: string }) => ({
    id: String(a.id),
    href: `/en/articles/${a.title}`,
    title: a.title,
    excerpt: '',
    category: 'Bridge Papers',
    date: '2026-01-01',
    dateLabel: '2026',
    readTime: 3,
    readTimeLabel: '3 min',
    author: { name: 'Mona' },
  }),
  labels: {
    collection: (t: string) => `The essays of ${t}`,
    articles: 'Related articles',
    courses: 'Courses',
    courseType: (type: string) => ({ CORE: 'Core Course', WORKSHOP: 'Workshop' })[type] ?? type,
  },
```

Change the expected value in the test `draws chosen courses with their fellows and cycle, and uses the admin’s label` to:

```ts
    expect(stacks.c).toEqual({
      label: 'This autumn',
      layout: 'stack',
      items: [{ name: 'Plato', role: 'Mona', description: 'Book by book.', href: '/study/plato', stat: 'Fall 2026, Cairo' }],
      posts: [],
      categories: [],
      seasons: {},
    })
```

Add these tests at the end of the `describe` block:

```ts
  it('draws a cycle’s courses as grid posts, with a tab for each course type', async () => {
    const stacks = await resolveCardStacks(payload, body(block({ id: 'g', layout: 'grid', source: 'cycle', cycle: { id: 5, title: 'Fall 2026, Cairo' } })), options as never)
    expect(stacks.g!.layout).toBe('grid')
    expect(stacks.g!.posts).toEqual([
      {
        id: 'plato',
        href: '/en/study/plato',
        title: 'Plato',
        excerpt: 'Book by book.',
        category: 'Core Course',
        label: 'Core Course',
        date: '',
        dateLabel: '',
        readTime: 0,
        readTimeLabel: '',
        author: { name: 'Mona' },
      },
      {
        id: 'archives',
        href: '/en/study/archives',
        title: 'Archives',
        excerpt: 'Reading the files.',
        category: 'Workshop',
        label: 'Workshop',
        date: '',
        dateLabel: '',
        readTime: 0,
        readTimeLabel: '',
        author: { name: '' },
        image: { src: '/media/a.jpg', alt: 'Files' },
      },
    ])
    expect(stacks.g!.categories).toEqual(['Core Course', 'Workshop'])
    expect(stacks.g!.seasons).toEqual({ plato: 'fall', archives: 'fall' })
  })

  it('keeps the chosen order in a grid, and shows no tabs for one course type', async () => {
    const stacks = await resolveCardStacks(payload, body(block({ id: 'g', layout: 'grid', source: 'courses', courses: [10] })), options as never)
    expect(stacks.g!.posts.map((p) => p.id)).toEqual(['plato'])
    expect(stacks.g!.categories).toEqual([])
  })

  it('draws chosen articles as grid posts without tabs', async () => {
    const stacks = await resolveCardStacks(payload, body(block({ id: 'g', layout: 'grid', source: 'articles', articles: [3, 2] })), options as never)
    expect(stacks.g!.posts.map((p) => p.title)).toEqual(['Third', 'Second'])
    expect(stacks.g!.categories).toEqual([])
  })

  it('reads a block from before the layout field as a stack', async () => {
    const stacks = await resolveCardStacks(payload, body(block({ id: 's', source: 'articles', articles: [2] })), options as never)
    expect(stacks.s!.layout).toBe('stack')
    expect(stacks.s!.posts).toEqual([])
  })
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm exec vitest run --config ./vitest.config.mts tests/unit/card-stacks.unit.spec.ts`
Expected: FAIL. The new tests fail on `layout` (it is `undefined`), and the changed test fails because `layout`, `posts`, `categories` and `seasons` are missing.

- [ ] **Step 3: Write the implementation**

In `src/api/card-stacks.api.ts`, change the imports to:

```ts
import type { Payload, Where } from 'payload'

import type { Locale, Reader } from '@/api/articles.api'
import type { BlogPost } from '@/components/arc/blocks/blog-grid/blog-grid-data'
import type { OrbitStackItem } from '@/components/ui/orbit-card-stack'
import { COURSE_TYPE_OPTIONS, type CourseType } from '@/fields/course-type'
import type { ArticleCard } from '@/lib/article-cards'
import type { Season } from '@/lib/cycle'
import { pathOf } from '@/lib/paths'
import type { Article, Course, Cycle, Media, Person, Publication } from '@/payload-types'
```

Replace the `ResolvedStack` type and add `GridPost`:

```ts
/** A grid card: a blog-grid post with the page it opens. */
export type GridPost = BlogPost & { href: string }

/** One Card stack block of an article's text, ready to draw. */
export type ResolvedStack = {
  label: string
  layout: 'stack' | 'grid'
  items: OrbitStackItem[]
  /** The grid's cards; empty for a stack. */
  posts: GridPost[]
  /** Course type names for the grid's tabs; empty when fewer than two types. */
  categories: string[]
  /** Course slug → its cycle's season, for a grid card without a cover. */
  seasons: Record<string, Season>
}
```

In `StackFields`, add after `blockType?: string`:

```ts
  layout?: 'stack' | 'grid' | null
```

After `courseItem`, add:

```ts
/** A course as a grid card: its type is its tab and its label. */
const coursePost = (c: Course, locale: Locale, typeName: (type: CourseType) => string): GridPost => {
  const type = typeName(c.course_type)
  const cover = coverOf(c.cover_image)
  return {
    id: c.slug ?? String(c.id),
    href: pathOf('courses', c, locale) ?? '#',
    title: c.title,
    excerpt: c.summary || c.subtitle || '',
    category: type,
    label: type,
    date: '',
    dateLabel: '',
    readTime: 0,
    readTimeLabel: '',
    author: { name: names(c.fellows) },
    ...('image' in cover ? { image: { src: cover.image, alt: cover.imageAlt } } : {}),
  }
}

/** One tab per course type present, in the types' own order; none for a single type. */
const typeTabs = (courses: Course[], typeName: (type: CourseType) => string): string[] => {
  const present = COURSE_TYPE_OPTIONS.map((o) => o.value).filter((v) => courses.some((c) => c.course_type === v))
  return present.length > 1 ? present.map(typeName) : []
}

const seasonsOf = (courses: Course[]): Record<string, Season> =>
  Object.fromEntries(
    courses.flatMap((c) => (typeof c.cycle === 'object' && c.cycle?.season && c.slug ? [[c.slug, c.cycle.season]] : [])),
  )
```

Change the doc comment and the options of `resolveCardStacks`:

```ts
/**
 * The Card stack blocks of an article's body, each with its cards, read as
 * this reader may: only published items they can open. Keyed by block id.
 * `articleItem` draws an article card as the page draws its others, and
 * `articleCard` the same article as a grid card; the open article is left
 * out of its own stack.
 */
export const resolveCardStacks = async (
  payload: Payload,
  body: unknown,
  {
    locale,
    user,
    current,
    articleItem,
    articleCard,
    labels,
  }: {
    locale: Locale
    user: Reader
    current: number
    articleItem: (a: Article, index: number, total: number) => OrbitStackItem
    articleCard: (a: Article) => ArticleCard
    labels: {
      collection: (title: string) => string
      articles: string
      courses: string
      courseType: (type: CourseType) => string
    }
  },
): Promise<Record<string, ResolvedStack>> => {
```

Keep `read`, `findArticles` and `findCourses` as they are. Replace the loop from `const out` down to `return out` with:

```ts
  const out: Record<string, ResolvedStack> = {}
  for (const block of stacksIn(body)) {
    if (!block.id) continue
    let articles: Article[] = []
    let courses: Course[] = []
    let label = block.label?.trim() || ''
    if (block.source === 'publication') {
      const pubId = idOf(block.publication)
      const pub = pubId
        ? await payload.findByID({ collection: 'publications', id: pubId, depth: 0, ...read }).catch(() => null)
        : null
      if (pub) {
        articles = await findArticles((pub.articles ?? []).map(idOf).filter((id): id is number => id !== null))
        label ||= labels.collection(pub.title)
      }
    } else if (block.source === 'articles') {
      articles = await findArticles((block.articles ?? []).map(idOf).filter((id): id is number => id !== null))
      label ||= labels.articles
    } else if (block.source === 'courses') {
      const ids = (block.courses ?? []).map(idOf).filter((id): id is number => id !== null)
      courses = ids.length ? await findCourses({ id: { in: ids } }, ids) : []
      label ||= labels.courses
    } else if (block.source === 'cycle') {
      const cycleId = idOf(block.cycle)
      courses = cycleId ? await findCourses({ cycle: { equals: cycleId } }) : []
      label ||= typeof block.cycle === 'object' && block.cycle?.title ? block.cycle.title : labels.courses
    }
    const items = [...articles.map((a, i) => articleItem(a, i, articles.length)), ...courses.map(courseItem)]
    if (!items.length) continue
    const grid = block.layout === 'grid'
    out[block.id] = {
      label,
      layout: grid ? 'grid' : 'stack',
      items,
      posts: grid ? [...articles.map(articleCard), ...courses.map((c) => coursePost(c, locale, labels.courseType))] : [],
      categories: grid ? typeTabs(courses, labels.courseType) : [],
      seasons: grid ? seasonsOf(courses) : {},
    }
  }
  return out
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm exec vitest run --config ./vitest.config.mts tests/unit/card-stacks.unit.spec.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/api/card-stacks.api.ts tests/unit/card-stacks.unit.spec.ts
git commit -m "feat(articles): a grid Card stack gives grid cards and course-type tabs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`article-page.tsx` does not compile until Task 4 gives the new options. The type check is in Task 5.)

---

### Task 3: The grid component and its message

**Files:**
- Modify: `messages/en.json`, `messages/ar.json`
- Create: `src/components/article/article-card-grid.tsx`

- [ ] **Step 1: Add the filter label**

In `messages/en.json`, in the `"Article"` object, after `"collectionStack": "The essays of {title}"`, add (put a comma after the line before it):

```json
    "gridFilterBy": "Filter by course type"
```

In `messages/ar.json`, at the same place, after `"collectionStack": "مقالات {title}"`:

```json
    "gridFilterBy": "تصفية حسب نوع المقرر"
```

- [ ] **Step 2: Write the component**

Create `src/components/article/article-card-grid.tsx`:

```tsx
'use client'

import { useLocale, useTranslations } from 'next-intl'

import type { GridPost } from '@/api/card-stacks.api'
import { BlogGrid } from '@/components/arc/blocks/blog-grid/blog-grid'
import { SEASON_ICONS } from '@/components/season-icon'
import type { Season } from '@/lib/cycle'
import { localDigits } from '@/lib/digits'

/**
 * A Card stack block set to grid, in an article's text: Arc's blog grid
 * with every card on one page, tabs by course type when there are two or
 * more, and a course without a cover showing its season's mark.
 */
export function ArticleCardGrid({
  posts,
  categories,
  seasons,
  label,
}: {
  posts: GridPost[]
  categories: string[]
  seasons: Record<string, Season>
  label: string
}) {
  const t = useTranslations('Articles.grid')
  const ta = useTranslations('Article')
  const locale = useLocale()
  return (
    <section aria-label={label} className="not-prose my-8">
      <BlogGrid
        categories={categories}
        defaultCategory="All"
        flush
        getHref={(post) => posts.find((p) => p.id === post.id)?.href ?? '#'}
        header={false}
        imageFallback={(post) => {
          const season = seasons[post.id]
          const Icon = season ? SEASON_ICONS[season] : undefined
          return Icon ? <Icon aria-hidden size={28} strokeWidth={1.5} /> : null
        }}
        labels={{
          all: t('all'),
          allPosts: t('allPosts'),
          filterBy: ta('gridFilterBy'),
          pagination: t('pagination'),
          previous: t('previous'),
          next: t('next'),
          previousPage: t('previousPage'),
          nextPage: t('nextPage'),
          page: (n) => t('page', { n }),
          number: (n) => localDigits(n, locale),
          empty: (category) => t('empty', { category }),
        }}
        order="given"
        pageSize={Math.max(1, posts.length)}
        posts={posts}
        showFeatured={false}
        title={label}
      />
    </section>
  )
}
```

- [ ] **Step 3: Check the new file with lint**

Run: `pnpm exec eslint src/components/article/article-card-grid.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/ar.json src/components/article/article-card-grid.tsx
git commit -m "feat(articles): the grid that shows a Card stack block set to grid

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The article page shows the grid

**Files:**
- Modify: `src/components/article/article-page.tsx` (imports near line 34; `resolveCardStacks` call near lines 123–143; `cardStack` renderer near lines 340–350)

- [ ] **Step 1: Import the grid**

After `import { ArticleCardStack } from '@/components/article/article-card-stack'`, add:

```ts
import { ArticleCardGrid } from '@/components/article/article-card-grid'
```

- [ ] **Step 2: Get the course-type names**

Near line 99, replace:

```ts
  const [t, tl, tArticles, tShare, format, collection] = await Promise.all([
    getTranslations('Article'),
    getTranslations('Language'),
    getTranslations('Articles'),
    getTranslations('Share'),
    getFormatter(),
    getArticleCollection(payload, article, locale, user),
  ])
```

with:

```ts
  const [t, tl, tArticles, tShare, format, collection, tf] = await Promise.all([
    getTranslations('Article'),
    getTranslations('Language'),
    getTranslations('Articles'),
    getTranslations('Share'),
    getFormatter(),
    getArticleCollection(payload, article, locale, user),
    getTranslations('Study.filters'),
  ])
```

- [ ] **Step 3: Give the resolver its new options**

In the `resolveCardStacks(payload, text, { ... })` call, after the `articleItem` function, add:

```ts
    articleCard: card,
```

and in `labels`, after `courses: t('stackCourses'),`, add:

```ts
      courseType: (type) => tf(`types.${type.toLowerCase()}`),
```

- [ ] **Step 4: Render the grid**

Replace the `cardStack` renderer:

```tsx
                      cardStack: (fields: { id?: string }) => {
                        const stack = fields.id ? stacks[fields.id] : undefined
                        if (!stack) return null
                        return stack.layout === 'grid' ? (
                          <ArticleCardGrid
                            categories={stack.categories}
                            label={stack.label}
                            posts={stack.posts}
                            seasons={stack.seasons}
                          />
                        ) : (
                          <ArticleCardStack
                            dir={isRtl(locale) ? 'rtl' : 'ltr'}
                            items={stack.items}
                            label={stack.label}
                          />
                        )
                      },
```

- [ ] **Step 5: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/article/article-page.tsx
git commit -m "feat(articles): an article shows a grid Card stack as a blog grid

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Check all of it

- [ ] **Step 1: Unit tests, lint, types**

Run: `pnpm exec vitest run --config ./vitest.config.mts tests/unit && pnpm exec eslint src/blocks src/api/card-stacks.api.ts src/components/article && pnpm exec tsc --noEmit`
Expected: all pass.

- [ ] **Step 2: Check in the browser**

Start the dev server (`pnpm dev`). In the admin, open an article draft and add a **Cards (stack or grid)** block with:
- Layout: Grid, Source: A cycle (all its courses), a cycle that has published public courses of 2 or more types.

Open the live preview, then the article page in `/en` and `/ar`. Expected:
- The cards of all the cycle's published public courses, with no pagination.
- Tabs "All" plus one tab for each course type. A tab shows only its courses.
- Each card opens `/<locale>/study/<slug>`.
- A course without a cover shows its season icon.
- On a phone width (390 px) the grid is one column and the page has no horizontal scroll. In `/ar` the tabs and cards go right to left.
- An old article with a Card stack block still shows the stack.

Do not save or publish the test article on a shared database. Delete the draft after the check.

- [ ] **Step 3: Report**

Report the results of the tests and the browser check. If a check fails, tell the user and do not change the scope.
