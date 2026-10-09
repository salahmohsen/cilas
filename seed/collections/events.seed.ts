import type { Payload } from 'payload'
import { slugify } from '@/lib/slugify'
import type { EventSeed, SeedContext } from '../seed.type'
import { getOrCreateId, lexical, requireIds } from '../seed.utils'

export const eventsData: EventSeed[] = [
    {
        // Real: Surti Singh and Robin Weiss discussed their essays from "On
        // the emergence of Pigeon Towers" at CILAS in the Fall of 2017,
        // audio-recorded (Teun Dekker and I-Kai Jeng joined via Skype).
        title: 'Essay Discussion: On the Emergence of Pigeon Towers',
        event_type: 'talk',
        tier: 'public',
        date: '2017-10-15',
        location: 'OFFLINE',
        fellows: ['surti.singh@cilas.test', 'robin.weiss@cilas.test'],
        description:
            'Surti Singh and Robin Weiss discuss their essays on the anchoring principles of play and ignorance from "On the emergence of Pigeon Towers" (CILAS, 2018) at CILAS in Darb el-Labbana, Fall 2017. The discussion was audio-recorded; Teun Dekker and I-Kai Jeng joined via Skype from the Netherlands and Taiwan.',
    },
    {
        title: 'End-of-Year Exhibition',
        event_type: 'exhibition',
        tier: 'public',
        date: '2026-06-05',
        location: 'OFFLINE',
        description: 'Public showcase of CILASian work.',
    },
    {
        title: 'Film Screening: The Man Who Shot Liberty Valance',
        event_type: 'screening',
        tier: 'public',
        date: '2026-05-03',
        location: 'OFFLINE',
    },
]

export const seedEvents = async (payload: Payload, ctx: SeedContext): Promise<void> => {
    for (const event of eventsData) {
        const { title, description, fellows, ...rest } = event
        await getOrCreateId(payload, 'events', { title: { equals: title } }, () =>
            payload.create({
                collection: 'events',
                data: {
                    ...rest,
                    title,
                    slug: slugify(title),
                    description: description ? lexical(description) : null,
                    ...(fellows ? { fellows: requireIds(ctx.users, fellows) } : {}),
                },
                overrideAccess: true,
            }),
        )
        console.log('event:', title)
    }
}
