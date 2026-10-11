import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'

import { importContent } from '../../migration/lib/import-content'
import type { SeedContext } from '../seed.type'

const archive = path.join(import.meta.dirname, '..', 'data', 'archive')
const read = (file: string) => JSON.parse(readFileSync(path.join(archive, file), 'utf8'))

/**
 * Articles and their publications come from the archive, not hand-written
 * seed data: "On the emergence of Pigeon Towers" (CILAS, 2018) in English and
 * Arabic, the Translation Lab booklet (Arabic), and the 2015 blog posts, as
 * normalised into seed/data/archive by migration/normalise-content.ts. The
 * import publishes them; an article with no text in a language has no body in
 * it, so the site shows it in its content language.
 *
 * Runs after the people seed: authors and translators resolve to the people
 * seeded in users.seed.ts by name, and anyone missing is created.
 */
export const seedArticles = async (payload: Payload, _ctx: SeedContext): Promise<void> => {
  const result = await importContent(payload, {
    articles: read('articles.json'),
    publications: read('publications.json'),
    press: [],
    events: [],
    newsletters: [],
  })
  console.log(
    `articles: ${result.articles.created} created, ${result.articles.updated} updated; publications: ${result.publications.created} created, ${result.publications.updated} updated`,
  )
}
