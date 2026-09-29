import type { Payload } from 'payload'
import type { EventSeed } from '../seed.type'
import { getOrCreateId, lexical } from '../seed.utils'

export const eventsData: EventSeed[] = [
    {
        title: 'End-of-Year Exhibition',
        event_type: 'exhibition',
        status: 'public',
        date: '2026-06-05',
        location: 'OFFLINE',
        description: 'Public showcase of CILASian work.',
    },
    {
        title: 'Film Screening: The Man Who Shot Liberty Valance',
        event_type: 'screening',
        status: 'public',
        date: '2026-05-03',
        location: 'OFFLINE',
    },
]

export const seedEvents = async (payload: Payload): Promise<void> => {
    for (const event of eventsData) {
        const { title, description, ...rest } = event
        await getOrCreateId(payload, 'events', { title: { equals: title } }, () =>
            payload.create({
                collection: 'events',
                data: {
                    ...rest,
                    title,
                    description: description ? lexical(description) : null,
                },
                overrideAccess: true,
            }),
        )
        console.log('event:', title)
    }
}
