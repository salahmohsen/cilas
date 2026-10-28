import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { env } from '../src/env'
import { getPublicEvents } from '../src/api/events.api'
import { readMovie } from '../src/lib/tmdb'
import type { Event } from '../src/payload-types'

const documentOf = (children: unknown[]) => ({
  root: { type: 'root', version: 1, children, direction: null, format: '', indent: 0 },
})
const paragraph = (text: string) => ({
  type: 'paragraph',
  version: 1,
  direction: null,
  format: '',
  indent: 0,
  children: [{ type: 'text', version: 1, text, format: 0, mode: 'normal', style: '', detail: 0 }],
})
const profile = (person: number) => ({
  type: 'block',
  version: 2,
  fields: { blockType: 'personProfile', person },
})

async function main() {
  const database = new URL(env.DATABASE_URL)
  if (
    database.hostname !== 'localhost' ||
    database.port !== '5433' ||
    database.pathname !== '/cilas_private_search_dev'
  ) {
    throw new Error('This content update is scoped to the local cilas_private_search_dev database.')
  }
  if (process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error(
      'Run with NEXT_PHASE=phase-production-build to keep external search indexing disabled.',
    )
  }
  const movie = await readMovie(753, 'en-US')
  if (
    movie.title !== 'Faces' ||
    !movie.releaseDate.startsWith('1968') ||
    !movie.directors.includes('John Cassavetes')
  ) {
    throw new Error('TMDB returned a different film. No content was changed.')
  }
  const payload = await getPayload({ config })
  const createdPeople: number[] = []
  let updated = false
  try {
    const { docs } = await payload.find({
      collection: 'events',
      where: { slug: { equals: 'faces-1968-screening' } },
      locale: 'en',
      fallbackLocale: false,
      depth: 0,
      limit: 1,
      overrideAccess: false,
    })
    const event = docs[0]
    if (!event) throw new Error('Faces screening not found.')
    const backup = join(tmpdir(), `cilas-faces-screening-${Date.now()}.json`)
    await writeFile(backup, JSON.stringify(event, null, 2), { mode: 0o600, flag: 'wx' })
    console.log(`Saved the original event to ${backup}`)

    const speakers = [
      {
        name: 'George Bartlett',
        slug: 'george-bartlett',
        bio: 'Writer and filmmaker who teaches cinema and psychoanalysis.',
      },
      { name: 'Omar Hesham', slug: 'omar-hesham', bio: 'Filmmaker and theatre improviser.' },
    ]
    const people: number[] = []
    for (const speaker of speakers) {
      const { docs } = await payload.find({
        collection: 'people',
        where: { or: [{ slug: { equals: speaker.slug } }, { name: { equals: speaker.name } }] },
        locale: 'en',
        depth: 0,
        limit: 2,
        overrideAccess: true,
      })
      if (docs.length > 1 || (docs[0] && !docs[0].visible)) {
        throw new Error(
          `Resolve the existing profile for ${speaker.name} before adding it to this public event.`,
        )
      }
      if (docs[0]) {
        people.push(docs[0].id)
      } else {
        const person = await payload.create({
          collection: 'people',
          locale: 'en',
          overrideAccess: true,
          data: {
            name: speaker.name,
            slug: speaker.slug,
            visible: true,
            bio: documentOf([paragraph(speaker.bio)]) as never,
          },
        })
        createdPeople.push(person.id)
        people.push(person.id)
      }
    }
    const first = event.description?.root.children.find((node) => node.type === 'paragraph')
    if (!first) throw new Error('The event introduction is missing.')
    const description = documentOf([
      first,
      {
        type: 'block',
        version: 2,
        fields: { blockType: 'movie', movie, subtitleLanguages: ['ar'] },
      },
      { ...paragraph('Post-screening discussion'), type: 'heading', tag: 'h2' },
      {
        type: 'block',
        version: 2,
        fields: {
          blockType: 'columns',
          columnCount: '2',
          ratio: 'equal',
          first: documentOf([profile(people[0])]),
          second: documentOf([profile(people[1])]),
        },
      },
    ]) as Event['description']
    await payload.update({
      collection: 'events',
      id: event.id,
      locale: 'en',
      overrideAccess: true,
      data: { description },
    })
    updated = true
    const [saved] = await getPublicEvents(payload, 'en', event.slug)
    const serialized = JSON.stringify(saved.description)
    for (const text of [
      '"blockType":"movie"',
      '"columnCount":"2"',
      'George Bartlett',
      'Omar Hesham',
    ]) {
      if (!serialized.includes(text)) throw new Error(`Saved content verification failed: ${text}`)
    }
    console.log(
      JSON.stringify({
        eventId: event.id,
        movieId: movie.id,
        discussants: speakers.map(({ name }) => name),
        verified: true,
      }),
    )
  } catch (error) {
    if (!updated) {
      for (const id of createdPeople)
        await payload.delete({ collection: 'people', id, overrideAccess: true })
    }
    throw error
  } finally {
    await payload.destroy()
  }
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Content update failed.')
    process.exit(1)
  },
)
