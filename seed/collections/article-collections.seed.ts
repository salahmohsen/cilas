import type { Payload } from 'payload'
import { slugify } from '@/lib/slugify'
import type { ArticleCollectionSeed, SeedContext } from '../seed.type'
import { getOrCreateId, lexical } from '../seed.utils'

export const articleCollectionsData: ArticleCollectionSeed[] = [
    {
        title: 'On the Emergence of Pigeon Towers',
        title_ar: 'عن ظهور برج الحمام',
        subtitle: 'Essays by Teun J. Dekker, Surti Singh, I-Kai Jeng and Robin Weiss',
        subtitle_ar: 'مقالات لتون ديكر وسورتي سينغ وإيكاي چانغ وروبن فايس',
        description: [
            'A collection of essays on the anchoring principles of a Pigeon Tower — diversity, intimacy, ignorance and play — derived from and inspired by the experience of CILAS.',
            'Conceived and edited by Karim-Yassin Goessinger, foreword by the author of the guiding metaphor. Written in dialogue with the founder over the second half of 2017, with a grant from the Arab Council of the Social Sciences funded by the Ford Foundation.',
            'The four contributing authors are all academic philosophers: two of them specialise in ancient philosophy and two in contemporary philosophy. The essays were written in English and translated into Arabic by Hussein El-Hajj. Surti and Robin discussed their essays at CILAS in the Fall of 2017; those discussions were audio-recorded. Published 2018 by CILAS under CC BY-NC-SA.',
        ],
        articles: [
            'On the Emergence of Pigeon Towers: Foreword',
            'Diversity and Differentiation in the Dialectic of Liberal Arts',
            'Playing Our Selves: An Aesthetic Education for the Twenty-First Century',
            'Equality and Intimacy: An Imaginary Construction',
            'On Ignorance',
        ],
        description_ar: [
            'مجموعة مقالات عن التركيزات القويمة لبرج الحمام — التنوع، والحميمية، والجهل، واللعب — المستمدة من تجربة معهد القاهرة للعلوم والآداب الحرة (سيلاس) والمستلهَمة منها.',
            'اقتُرحت المجموعة وحُرّرها كريم ياسين جوسينجر، وتتقدمها تمهيدته صاحب الاستعارة الإرشادية. كُتبت بالحوار مع المؤسس خلال النصف الثاني من 2017، بدعم منحة من المجلس العربي للعلوم الاجتماعية بتمويل مؤسسة فورد.',
            'أربعة مؤلفين كلهم فلاسفة أكاديميون: اثنان متخصصان في الفلسفة القديمة واثنان في الفلسفة المعاصرة. كُتبت المقالات بالإنجليزية ثم ترجمها حسين الحاج إلى العربية، ونوقِش مقالا سورتي وروبن في سيلاس في خريف 2017 وتم تسجيل تلك النقاشات صوتيًا. صدرت المجموعة عام 2018 برخصة المشاع الإبداعي: نسب المصنّف — غير تجاري — الترخيص بالمثل.',
        ],
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
            'خمسة مقالات تُرجمت جماعيًا على مدار ثلاث سنوات في إطار تربوي هادف، بهدف التفكير في الترجمة بوصفها فعلًا ومجهودًا ذهنيًا. صدرت الطبعة الأولى عام 2018 عن معهد القاهرة للعلوم والآداب الحرة برخصة المشاع الإبداعي: نسب المصنّف للمؤلف – غير تجاري – الترخيص بالمثل.',
            'تعود الطبعة إلى تقرير المختبر عن طريقة عمله: ينقسم النص بين المشاركين، وتُترجم أجزاءً تُراجع جماعيًا حتى الاتفاق على صياغة نهائية — تعاون تُنتجه نصًّا مشتركًا لا مجرد نتيجة مشتركة.',
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
