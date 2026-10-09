import type { Payload } from 'payload'
import { slugify } from '@/lib/slugify'
import type { ArticleCollectionSeed, SeedContext } from '../seed.type'
import { getOrCreateId, lexical } from '../seed.utils'

export const articleCollectionsData: ArticleCollectionSeed[] = [
    {
        title: 'On Pigeon Towers',
        subtitle: 'Pigeon Towers',
        description:
            'A collection of essays on the emergence of Pigeon Towers — CILAS’ guiding metaphor.',
    },
    {
        title: 'Works of the Translation Lab',
        title_ar: 'أعمال مختبر الترجمة',
        subtitle: 'Translation as education',
        subtitle_ar: 'الترجمة بصفتها تعليمًا',
        description: [
            'The collected works of the CILAS Translation Lab, 2016–2018.',
            'Five articles translated collectively by the lab’s students and fellows over three years, in an explicitly pedagogical setting, as an exercise in thinking about translation as an act and a mental effort. Published 2018 by the Institute for Translation and Interpreting (ci-las.org) under CC BY-NC-SA.',
            'The volume is prefaced by the lab’s own account of its method: a text is divided among participants, translated in parts, then revised collectively until agreement on a final wording is reached — a shared task that produces a shared text, not merely a shared result.',
        ],
        articles: [
            'Recovering from the Diploma Disease',
            'Reclaiming Our Fire in Education',
            'A Short History of Alternative Education',
            'On How to Read Theoretical Works',
            'Reading, Writing, and Understanding',
        ],
        description_ar: [
            'أعمال مختبر الترجمة بمعهد القاهرة للعلوم والآداب الحرة (سيلاس) من 2016 إلى 2018.',
            'خمسة مقالات تُرجمت جماعيًا على مدار ثلاث سنوات في إطار تربوي هادف، في سياق疫情防控 على مختبر الترجمة بوصفه فعلًا ومجهودًا ذهنيًا. صدرت الطبعة الأولى عام 2018 عن معهد القاهرة للعلوم والآداب الحرة برخصة المشاع الإبداعي: نسب المصنف للمؤلف – غير تجاري – ترخيص المؤلف بالمثل.',
        ],
    },
]

/**
 * English article title -> numeric article id. The lab articles are seeded
 * before this collection, so a miss here is a seed-order bug, not data drift.
 */
const resolveArticleIds = async (payload: Payload, titles: string[]): Promise<number[]> => {
    const ids: number[] = []

    for (const articleTitle of titles) {
        const res = await payload.find({
            collection: 'articles',
            where: { title: { equals: articleTitle } },
            depth: 0,
            limit: 1,
            overrideAccess: true,
        })
        const articleId = res.docs[0]?.id

        if (typeof articleId !== 'number') {
            throw new Error(`seed: article "${articleTitle}" not found — seed articles before collections`)
        }

        ids.push(articleId)
    }

    return ids
}

export const seedArticleCollections = async (payload: Payload, ctx: SeedContext): Promise<void> => {
    for (const collection of articleCollectionsData) {
        const { title, description, articles, title_ar, subtitle_ar, description_ar, ...rest } = collection

        const articleIds = articles ? await resolveArticleIds(payload, articles) : undefined

        const id = await getOrCreateId(payload, 'article-collections', { title: { equals: title } }, () =>
            payload.create({
                collection: 'article-collections',
                data: {
                    ...rest,
                    title,
                    slug: slugify(title),
                    description: description ? lexical(description) : null,
                    ...(articleIds ? { articles: articleIds } : {}),
                },
                overrideAccess: true,
            }),
        )

        if (title_ar || subtitle_ar || description_ar) {
            await payload.update({
                collection: 'article-collections',
                id,
                data: {
                    ...(title_ar ? { title: title_ar } : {}),
                    ...(subtitle_ar ? { subtitle: subtitle_ar } : {}),
                    ...(description_ar ? { description: lexical(description_ar, 'rtl') } : {}),
                },
                locale: 'ar',
                overrideAccess: true,
            })
        }

        ctx.articleCollections[title] = id
        console.log('article-collection:', title)
    }
}
