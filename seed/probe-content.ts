import { config as loadEnv } from 'dotenv'
import { getPayload } from 'payload'

/**
 * Dev only: one English event and one course with every field filled, so a
 * designer can see each element the event and course pages can render.
 * Idempotent by slug: a second run updates the two probes in place.
 * Refuses to run against anything but the local development database.
 *
 *   npx tsx seed/probe-content.ts [path/to/env-dir]
 */

const envDir = process.argv[2] ?? '.'
loadEnv({ path: `${envDir}/.env` })
loadEnv({ path: `${envDir}/.env.local`, override: true })
loadEnv({ path: `${envDir}/.env.development.local`, override: true })
process.env.TYPESENSE_API_KEY = ''
const [{ default: config }, { env }] = await Promise.all([
  import('../src/payload.config'),
  import('../src/env'),
])

const local = new Set(['localhost', '127.0.0.1', '[::1]'])
const database = new URL(env.DATABASE_URL)
if (
  process.env.NODE_ENV === 'production' ||
  !local.has(database.hostname) ||
  !database.pathname.endsWith('_dev')
)
  throw new Error('The probes need the local development database.')

const payload = await getPayload({ config })
// Relationship checks inside rich text run with the request's user, so the
// probes are written as an admin.
const admin = (
  await payload.find({
    collection: 'users',
    where: { roles: { in: ['admin', 'super_admin'] } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
).docs[0]
if (!admin) throw new Error('The dev database needs an admin user.')

/* ============================================================ lookups */

const first = async (
  collection:
    | 'people'
    | 'media'
    | 'places'
    | 'cycles'
    | 'articles'
    | 'programmes'
    | 'courses'
    | 'events',
  where: object = {},
  limit = 1,
) =>
  (
    await payload.find({
      collection,
      where: where as never,
      limit,
      depth: 0,
      overrideAccess: true,
      sort: collection === 'people' ? 'id' : '-id',
    })
  ).docs.map((doc) => Number(doc.id))

const people = await first('people', { photo: { exists: true }, visible: { equals: true } }, 3)
const images = await first(
  'media',
  { mimeType: { contains: 'image/' }, width: { greater_than: 1000 } },
  6,
)
const [place] = await first('places')
const [cycle] = await first('cycles')
const [article] = await first('articles', {
  tier: { equals: 'public' },
  _status: { equals: 'published' },
})
const [programme] = await first('programmes')
const [otherCourse] = await first('courses', {
  tier: { equals: 'public' },
  _status: { equals: 'published' },
  slug: { not_equals: 'probe-full-course' },
})
const [otherEvent] = await first('events', {
  tier: { equals: 'public' },
  _status: { equals: 'published' },
  slug: { not_equals: 'probe-full-event' },
})
if (people.length < 2 || images.length < 4 || !place || !cycle)
  throw new Error('The dev database needs people with photos, images, a place and a cycle.')

// A real movie block, copied from the first event that has one.
const movieBlock = await (async () => {
  const { docs } = await payload.find({
    collection: 'events',
    limit: 200,
    depth: 0,
    overrideAccess: true,
    locale: 'en',
  })
  for (const doc of docs) {
    const node = (doc.description?.root?.children as Array<Record<string, any>> | undefined)?.find(
      (child) => child.type === 'block' && child.fields?.blockType === 'movie',
    )
    if (node) return node
  }
  return null
})()

/* ============================================================ lexical */

let key = 0
const id = () => `probe${(++key).toString(16).padStart(20, '0')}`
const FORMAT = { bold: 1, italic: 2, strike: 4, underline: 8, code: 16, sub: 32, sup: 64 }
const t = (text: string, format = 0) => ({
  type: 'text',
  text,
  format,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})
const el = (type: string, children: unknown[], extra: object = {}) => ({
  type,
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  ...extra,
})
const p = (...children: unknown[]) => el('paragraph', children, { textFormat: 0, textStyle: '' })
const h = (tag: string, text: string) => el('heading', [t(text)], { tag })
const quote = (text: string) => el('quote', [t(text)])
const list = (listType: 'bullet' | 'number' | 'check', items: string[]) =>
  el(
    'list',
    items.map((item, index) =>
      el('listitem', [t(item)], {
        value: index + 1,
        ...(listType === 'check' ? { checked: index % 2 === 0 } : {}),
      }),
    ),
    { listType, tag: listType === 'number' ? 'ol' : 'ul', start: 1 },
  )
const link = (text: string, url: string) =>
  el('link', [t(text)], { fields: { linkType: 'custom', url, newTab: true }, id: id() })
const internal = (text: string, relationTo: string, value: number) =>
  el('link', [t(text)], {
    fields: { linkType: 'internal', doc: { relationTo, value }, newTab: false },
    id: id(),
  })
const upload = (value: number) => ({
  type: 'upload',
  relationTo: 'media',
  value,
  fields: null,
  format: '',
  id: id(),
  version: 3,
})
const hr = { type: 'horizontalrule', version: 1 }
const block = (fields: object) => ({
  type: 'block',
  format: '',
  version: 2,
  fields: { id: id(), blockName: '', ...fields },
})
const mention = (label: string, person: number) => ({
  type: 'inlineBlock',
  version: 1,
  fields: { id: id(), blockName: '', blockType: 'mention', label, type: 'person', person },
})
const root = (...children: unknown[]) => ({
  root: { type: 'root', children, direction: 'ltr', format: '', indent: 0, version: 1 },
})

const LOREM =
  'We read slowly, together, and stop where a sentence resists us. Each meeting starts from one short text and ends with a question the group carries into the week.'

/** Every text node, list, heading level and block the editor offers. */
const richBody = () =>
  root(
    p(
      t('A paragraph with '),
      t('bold', FORMAT.bold),
      t(', '),
      t('italic', FORMAT.italic),
      t(', '),
      t('underline', FORMAT.underline),
      t(', '),
      t('strikethrough', FORMAT.strike),
      t(', '),
      t('inline code', FORMAT.code),
      t(', H'),
      t('2', FORMAT.sub),
      t('O, x'),
      t('2', FORMAT.sup),
      t(', a '),
      link('link out', 'https://example.com'),
      t(', an '),
      ...(article ? [internal('internal link', 'articles', article)] : [t('internal link')]),
      t(' and a mention of '),
      mention('a fellow', people[0]!),
      t('.'),
    ),
    p(t(LOREM)),
    h('h2', 'Heading two'),
    p(t(LOREM)),
    h('h3', 'Heading three'),
    p(t(LOREM)),
    h('h4', 'Heading four'),
    p(t(LOREM)),
    h('h5', 'Heading five'),
    h('h6', 'Heading six'),
    list('bullet', [
      'A bullet item',
      'A second, longer bullet item that wraps onto a second line on a narrow screen',
      'A third',
    ]),
    list('number', ['A numbered item', 'A second numbered item', 'A third']),
    list('check', ['A checked item', 'An unchecked item', 'Checked again']),
    quote('A block quote: what a student discovers matters more than what we cover.'),
    el('paragraph', [t('A centred paragraph.')], {
      format: 'center',
      textFormat: 0,
      textStyle: '',
    }),
    el('paragraph', [t('An indented paragraph.')], { indent: 1, textFormat: 0, textStyle: '' }),
    hr,
    upload(images[0]!),
    p(t('A paragraph after an image.')),
    block({
      blockType: 'columns',
      columnCount: '2',
      ratio: 'equal',
      first: root(h('h3', 'Left column'), p(t(LOREM))),
      second: root(upload(images[1]!)),
    }),
    block({
      blockType: 'columns',
      columnCount: '3',
      ratio: 'equal',
      first: root(p(t(LOREM))),
      second: root(p(t(LOREM))),
      third: root(upload(images[2]!)),
    }),
    block({
      blockType: 'gallery',
      columnCount: '3',
      images: images.slice(0, 5).map((image, index) => ({
        id: id(),
        image,
        caption: index % 2 ? `Caption for image ${index + 1}` : undefined,
      })),
    }),
    block({ blockType: 'personProfile', person: people[1]! }),
    ...(otherCourse
      ? [
          block({
            blockType: 'relatedContent',
            document: { relationTo: 'courses', value: otherCourse },
          }),
        ]
      : []),
    ...(movieBlock ? [{ ...movieBlock, fields: { ...movieBlock.fields, id: id() } }] : []),
    p(t('The last paragraph.')),
  )

const short = (text: string) => root(p(t(text)))

/* ============================================================ probes */

const upsert = async (
  collection: 'events' | 'courses',
  slug: string,
  data: Record<string, unknown>,
) => {
  const { docs } = await payload.find({
    collection,
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    draft: true,
  })
  const common = {
    overrideAccess: true,
    user: { ...admin, collection: 'users' as const },
    locale: 'en' as const,
    context: { disableRevalidate: true },
  }
  const doc = docs[0]
    ? await payload.update({ collection, id: docs[0].id, data: data as never, ...common })
    : await payload.create({ collection, data: data as never, ...common })
  console.log(
    `${collection}: ${doc.id} /en/${collection === 'events' ? 'events' : 'study'}/${slug}`,
  )
}

const pricing = {
  options: [
    { amount: 2500, default: true },
    { amount: 3000, default: false },
  ],
  currency: 'EGP',
  note: 'Sliding scale: choose the tier that fits your budget.',
  need_based_deductions: true,
}

await upsert('events', 'probe-full-event', {
  title: 'Probe: an event with every field filled, and a title long enough to wrap',
  slug: 'probe-full-event',
  tier: 'public',
  _status: 'published',
  cover_image: images[3],
  event_type: 'screening',
  description: richBody(),
  speakers: [
    { person: people[0], role: 'Speaker' },
    { person: people[1], role: 'Moderator' },
    ...(people[2] ? [{ person: people[2], role: 'Respondent' }] : []),
  ],
  schedule: {
    mode: 'single',
    start_date: '2026-12-10T12:00:00.000Z',
    start_time: '18:00',
    end_time: '21:30',
    note: 'Doors open at 17:30. The discussion runs in Arabic and English.',
  },
  place,
  external_venue: {
    name: 'Probe venue',
    address: '12 Example Street, Downtown, Cairo',
    map_url: 'https://maps.google.com/?q=Cairo',
  },
  online_url: 'https://example.com/live',
  agenda: [
    { start_time: '18:00', end_time: '18:15', title: 'Welcome' },
    { start_time: '18:15', end_time: '20:00', title: 'Screening' },
    { start_time: '20:00', end_time: '21:30', title: 'Discussion with the speakers' },
  ],
  registration: {
    method: 'external',
    url: 'https://example.com/register',
    deadline: '2026-12-08T12:00:00.000Z',
  },
  pricing,
  ...(otherEvent ? { series: otherEvent } : {}),
  ...(programme ? { programme } : {}),
  ...(otherCourse ? { course: otherCourse } : {}),
})

const session = (order: number, extra: Record<string, unknown> = {}) => ({
  order,
  session_title: `Session ${order}: a title for this meeting`,
  meetings: 1,
  description: short(LOREM),
  bibliography: [
    {
      type: 'reading',
      title: `Reading for session ${order}`,
      href: 'https://example.com/reading',
      note: 'Pages 1 to 24.',
    },
    { type: 'watch', title: 'A film to watch before we meet', href: 'https://example.com/watch' },
    { type: 'listen', title: 'A recording to listen to' },
    { type: 'prompt', title: 'A question to bring', note: 'Write one paragraph.' },
  ],
  activities: [
    { kind: 'discussion', description: 'Open discussion of the reading.' },
    { kind: 'exercise', description: 'A short writing exercise in pairs.' },
    { kind: 'field_visit', description: 'A walk to the old city archive.' },
  ],
  ...extra,
})

await upsert('courses', 'probe-full-course', {
  title: 'Probe: a course with every field filled, and a title long enough to wrap',
  slug: 'probe-full-course',
  tier: 'public',
  _status: 'published',
  cover_image: images[0],
  subtitle: 'A subtitle: an introduction to everything the page can show',
  summary: 'One line for cards and search results.',
  epigraph: 'What does a city remember?',
  description: richBody(),
  fellows: people.slice(0, 2),
  course_type: 'THEMATIC',
  cycle,
  location: ['OFFLINE', 'ONLINE'],
  teaching_languages: ['en', 'ar'],
  language_note: 'Readings in Arabic, discussion in either.',
  sessions: [
    session(1),
    session(2, { meetings: 2 }),
    session(3, { cancelled: true }),
    session(4, {
      dates: [
        { date: '2027-01-20T12:00:00.000Z', start_time: '10:00', end_time: '13:00' },
        { date: '2027-01-22T12:00:00.000Z', start_time: '16:00', end_time: '19:00' },
      ],
    }),
    session(5),
  ],
  bibliography: [
    {
      type: 'reading',
      title: 'A book for the whole course',
      href: 'https://example.com/book',
      note: 'Read the introduction first.',
    },
    { type: 'other', title: 'A course-wide resource' },
  ],
  facilitator_note:
    'Bring an apron and a notebook; all materials are provided. Work is assessed on a final short essay.',
  content_warning: 'Discusses violence and loss in some of the readings.',
  syllabus_tentative: true,
  session_unit: 'week',
  schedule: {
    start_date: '2026-12-06T12:00:00.000Z',
    weeks: 8,
    slots: [
      { weekday: 'sun', start_time: '18:00', end_time: '20:30' },
      { weekday: 'wed', start_time: '18:00', end_time: '20:30' },
    ],
    note: 'Hybrid for the first four weeks, then in person only.',
  },
  registration: {
    mode: 'own',
    method: 'external',
    url: 'https://example.com/apply',
    deadline: '2026-12-01T12:00:00.000Z',
  },
  pricing_override: pricing,
})

process.exit(0)
