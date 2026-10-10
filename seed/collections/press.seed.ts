import type { Payload } from 'payload'
import type { PressSeed, SeedContext } from '../seed.type'
import { getOrCreateId, requireId } from '../seed.utils'

export const pressData: PressSeed[] = [
    {
        outlet: 'Mada Masr',
        title: 'Attempting to decolonize pedagogy in CILAS Alexandria',
        url:
            'https://www.madamasr.com/en/2019/09/18/feature/culture/attempting-to-decolonize-pedagogy-in-cilas-alexandria/',
        published_date: '2019-09-18',
        language: 'en',
    },
    {
        outlet: 'OpenDemocracy',
        title: 'Sitting on top of Egyptian civilisation',
        url:
            'https://www.opendemocracy.net/en/north-africa-west-asia/mona-abaza-karim-yassin-goessinger/sitting-on-top-of-egyptian-civilisation/',
        published_date: '2016-01-01',
        date_precision: 'year',
        language: 'en',
    },
    {
        outlet: 'Egyptian Streets',
        title: 'Liberal Arts Institute Turns To Crowdfunding',
        url:
            'https://egyptianstreets.com/2015/02/24/liberal-arts-and-sciences-institute-turns-to-crowdfunding-after-egyptian-government-blocks-funding/',
        published_date: '2015-02-24',
        language: 'en',
    },
    {
        outlet: 'Al-Fanar Media',
        title: 'New institute to offer one year dose of the liberal arts',
        url:
            'https://www.al-fanarmedia.org/2013/08/new-institute-to-offer-one-year-dose-of-the-liberal-arts/',
        published_date: '2013-08-01',
        date_precision: 'month',
        language: 'en',
    },
    {
        outlet: 'Mashallah News',
        title: 'Learning on Wings',
        url: 'https://www.mashallahnews.com/learning-on-wings/',
        published_date: '2015-01-01',
        date_precision: 'year',
        language: 'en',
    },
]

export const seedPress = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const { outlet, url, language, ...item } of pressData) {
    await getOrCreateId(payload, 'press', { title: { equals: item.title } }, () =>
      payload.create({
        collection: 'press',
        data: {
          ...item,
          kind: 'coverage',
          language,
          outlet: requireId(ctx.partners, outlet),
          links: [{ language, url }],
        },
        overrideAccess: true,
      }),
    )
    console.log('press:', item.title)
  }
}
