import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

const origin = new URL(process.argv[2] ?? 'http://localhost:3000').origin
const fetchPage = async (path) => {
  const response = await fetch(new URL(path, origin), {
    headers: { 'user-agent': 'Googlebot' },
    signal: AbortSignal.timeout(120_000),
  })
  return { response, text: await response.text() }
}

const sitemap = await fetchPage('/sitemap.xml')
assert.equal(sitemap.response.status, 200, 'Sitemap must return 200')
const xml = new JSDOM(sitemap.text, { contentType: 'text/xml' }).window.document
const entries = [...xml.querySelectorAll('url')]
assert.ok(entries.length, 'Sitemap must contain public pages')

const selected = new Set()
const samples = new Map()
for (const entry of entries) {
  const url = new URL(entry.querySelector('loc').textContent)
  assert.equal(url.origin, origin, `Wrong sitemap origin for ${url.pathname}`)
  const links = [...entry.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'link')]
  const alternates = Object.fromEntries(
    links.map((link) => [link.getAttribute('hreflang'), link.getAttribute('href')]),
  )
  const locale = url.pathname.split('/')[1]
  assert.equal(alternates[locale], url.href, `Missing self alternate for ${url.pathname}`)
  assert.ok(
    alternates.en && alternates.ar && alternates['x-default'],
    `Incomplete sitemap languages for ${url.pathname}`,
  )
  if (
    process.argv.includes('--all') ||
    url.pathname.split('/').length <= 3 ||
    /^\/(en|ar)\/people\/(fellows|cilasians)$/.test(url.pathname)
  )
    selected.add(url.pathname)
  const group =
    !/^\/(en|ar)\/people\/(fellows|cilasians)$/.test(url.pathname) &&
    url.pathname
      .match(/^\/(en|ar)\/(study|articles|events|people)\//)
      ?.slice(1)
      .join('/')
  if (group && (samples.get(group) ?? 0) < 2) {
    selected.add(url.pathname)
    samples.set(group, (samples.get(group) ?? 0) + 1)
  }
}
for (const arg of process.argv.slice(3)) {
  if (arg.startsWith('--path=')) selected.add(arg.slice('--path='.length))
}

const failures = []
let checked = 0
for (const path of selected) {
  let dom
  try {
    const { response, text } = await fetchPage(path)
    assert.equal(response.status, 200, `${path} must return 200`)
    assert.equal(
      new URL(response.url).pathname,
      new URL(path, origin).pathname,
      `${path} must not redirect`,
    )
    dom = new JSDOM(text)
    const document = dom.window.document
    if (/^\/(en|ar)\/(study|articles|events)$/.test(path)) {
      const pageTwo = [...document.querySelectorAll('nav a[href]')]
        .map((link) => new URL(link.getAttribute('href'), new URL(path, origin)))
        .find((url) => url.pathname === path && url.searchParams.get('page') === '2')
      if (pageTwo) selected.add(`${pageTwo.pathname}${pageTwo.search}`)
    }
    assert.ok(document.title.trim(), `${path} needs a title`)
    assert.ok(
      document.querySelector('meta[name="description"]')?.content,
      `${path} needs a description`,
    )
    assert.ok(
      !document.querySelector('meta[name="robots"]')?.content.includes('noindex'),
      `${path} is in the sitemap but noindex`,
    )
    assert.equal(
      document.querySelector('link[rel="canonical"]')?.href,
      `${origin}${path}`,
      `${path} needs a self canonical`,
    )
    const links = [...document.querySelectorAll('link[rel="alternate"][hreflang]')]
    for (const language of ['en', 'ar', 'x-default']) {
      const expected = path.replace(
        /^\/(en|ar)(?=\/|$)/,
        `/${language === 'x-default' ? 'en' : language}`,
      )
      assert.equal(
        links.find((link) => link.hreflang === language)?.href,
        `${origin}${expected}`,
        `${path} needs its ${language} alternate`,
      )
    }
    // Each script is one object: a single item, or several under one @graph.
    const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(
      (script) => {
        const data = JSON.parse(script.textContent)
        assert.equal(data['@context'], 'https://schema.org', `Invalid JSON-LD context on ${path}`)
        return data['@graph'] ?? [data]
      },
    )
    for (const schema of schemas) {
      if (schema['@type'] === 'Event') {
        assert.match(path, /^\/(en|ar)\/events\/.+/, 'Event markup belongs on an event detail page')
        assert.equal(schema.url, `${origin}${path}`, 'Event URL must identify this page')
        assert.ok(
          schema.startDate && schema.location?.[0]?.address,
          'Event needs a date and venue address',
        )
      }
      if (schema['@type'] === 'Course') {
        assert.equal(schema.url, `${origin}${path}`, 'Course URL must identify this page')
        assert.ok(
          schema.name && schema.description && schema.provider?.name,
          'Course needs a name, description and provider',
        )
        for (const instance of schema.hasCourseInstance ?? []) {
          assert.equal(instance['@type'], 'CourseInstance')
          assert.notEqual(
            typeof instance.courseSchedule,
            'string',
            'Course schedule must be a Schedule object',
          )
        }
      }
      if (schema['@type'] === 'ProfilePage' && schema.mainEntity?.description) {
        assert.equal(
          document.querySelector('meta[name="description"]')?.content,
          schema.mainEntity.description.slice(0, 160),
          'Profile snippet must describe the visible biography',
        )
      }
    }
    assert.ok(
      !document.querySelector('link[rel="canonical"]')?.href.includes('/signed-in'),
      'Public canonical must not name a signed-in route',
    )
    checked++
  } catch (error) {
    failures.push(`${path}: ${error.message}`)
  } finally {
    dom?.window.close()
  }
}

for (const path of ['/en/login', '/ar/login', '/en/signed-in', '/ar/signed-in']) {
  const { response, text } = await fetchPage(path)
  assert.equal(response.status, 200, `${path} must be reachable to read noindex`)
  const document = new JSDOM(text).window.document
  assert.ok(
    document.querySelector('meta[name="robots"]')?.content.includes('noindex'),
    `${path} needs noindex`,
  )
  document.defaultView.close()
}
const robots = await fetchPage('/robots.txt')
assert.equal(robots.response.status, 200)
assert.ok(robots.text.includes(`Sitemap: ${origin}/sitemap.xml`))
assert.ok(
  !/^Disallow: \/(?:en|ar)(?:\/|$)/m.test(robots.text),
  'Page routes must allow crawlers to read noindex',
)

console.log(
  `Checked ${entries.length} sitemap entries and ${checked}/${selected.size} sampled public pages, plus login and signed-in noindex directives.`,
)
for (const failure of failures) console.error(failure)
assert.equal(failures.length, 0, 'Rendered SEO checks failed')
