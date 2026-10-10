import type { Payload } from 'payload'
import { slugify } from '@/lib/slugify'
import type { EventSeed, SeedContext } from '../seed.type'
import { getOrCreateId, lexical, once, requireId } from '../seed.utils'

export const eventsData: EventSeed[] = [
    {
        // Real: Surti Singh and Robin Weiss discussed their essays from "On
        // the emergence of Pigeon Towers" at CILAS in the Fall of 2017,
        // audio-recorded (Teun Dekker and I-Kai Jeng joined via Skype).
        title: 'Essay Discussion: On the Emergence of Pigeon Towers',
        event_type: 'talk',
        tier: 'public',
        schedule: once('2017-10-15', '18:00', '20:00'),
        space: 'Darb el-Labbana',
        speakers: ['surti.singh@cilas.test', 'robin.weiss@cilas.test'],
        description:
            'Surti Singh and Robin Weiss discuss their essays on the anchoring principles of play and ignorance from "On the emergence of Pigeon Towers" (CILAS, 2018) at CILAS in Darb el-Labbana, Fall 2017. The discussion was audio-recorded; Teun Dekker and I-Kai Jeng joined via Skype from the Netherlands and Taiwan.',
    },
    {
        title: 'End-of-Year Exhibition',
        event_type: 'open_day',
        tier: 'public',
        schedule: once('2026-06-05', '16:00', '21:00'),
        space: 'Darb el-Labbana',
        description: 'Public showcase of CILASian work.',
    },
    {
        title: 'Film Screening: The Man Who Shot Liberty Valance',
        event_type: 'screening',
        tier: 'public',
        schedule: once('2026-05-03', '19:00', '22:00'),
        space: 'Darb el-Labbana',
    },
]

export const seedEvents = async (payload: Payload, ctx: SeedContext): Promise<void> => {
    for (const event of eventsData) {
        const { title, description, space, speakers, ...rest } = event
        await getOrCreateId(payload, 'events', { title: { equals: title } }, () =>
            payload.create({
                collection: 'events',
                data: {
                    ...rest,
                    title,
                    slug: slugify(title),
                    description: description ? lexical(description) : null,
                    ...(space ? { space: requireId(ctx.spaces, space) } : {}),
                    speakers: (speakers ?? []).map((email) => ({ person: requireId(ctx.people, email) })),
                },
                overrideAccess: true,
            }),
        )
        console.log('event:', title)
    }
}
