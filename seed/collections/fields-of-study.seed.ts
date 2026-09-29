import type { Payload } from 'payload'
import type { FieldOfStudySeed, SeedContext } from '../seed.type'
import { getOrCreateId } from '../seed.utils'

export const fieldsOfStudyData: FieldOfStudySeed[] = [
    { title: 'Historical Consciousness', title_ar: 'الوعي التاريخي' },
    { title: 'Philosophical and Poetic Inquiry', title_ar: 'البحث الفلسفي والشعري' },
    { title: 'Ethnographic Study', title_ar: 'الدراسة الإثنوغرافية' },
]

export const seedFieldsOfStudy = async (payload: Payload, ctx: SeedContext): Promise<void> => {
    for (const field of fieldsOfStudyData) {
        const { title_ar, ...en } = field

        const id = await getOrCreateId(
            payload,
            'fields-of-study',
            { title: { equals: en.title } },
            () =>
                payload.create({
                    collection: 'fields-of-study',
                    data: en,
                    overrideAccess: true,
                }),
        )

        await payload.update({
            collection: 'fields-of-study',
            id,
            data: { title: title_ar },
            locale: 'ar',
            overrideAccess: true,
        })

        ctx.fieldsOfStudy[en.title] = id
        console.log('field-of-study:', en.title)
    }
}
