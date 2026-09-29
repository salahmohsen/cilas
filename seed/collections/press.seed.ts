import type { Payload } from 'payload'
import type { PressSeed } from '../seed.type'
import { getOrCreateId } from '../seed.utils'

export const pressData: PressSeed[] = [
    {
        organisation: 'Mada Masr',
        article_title: 'Attempting to decolonize pedagogy in CILAS Alexandria',
        article_url:
            'https://www.madamasr.com/en/2019/09/18/feature/culture/attempting-to-decolonize-pedagogy-in-cilas-alexandria/',
        published_date: '2019-09-18',
    },
    {
        organisation: 'OpenDemocracy',
        article_title: 'Sitting on top of Egyptian civilisation',
        article_url:
            'https://www.opendemocracy.net/en/north-africa-west-asia/mona-abaza-karim-yassin-goessinger/sitting-on-top-of-egyptian-civilisation/',
        published_date: '2016-01-01',
    },
    {
        organisation: 'Egyptian Streets',
        article_title: 'Liberal Arts Institute Turns To Crowdfunding',
        article_url:
            'https://egyptianstreets.com/2015/02/24/liberal-arts-and-sciences-institute-turns-to-crowdfunding-after-egyptian-government-blocks-funding/',
        published_date: '2015-02-24',
    },
    {
        organisation: 'Al-Fanar Media',
        article_title: 'New institute to offer one year dose of the liberal arts',
        article_url:
            'https://www.al-fanarmedia.org/2013/08/new-institute-to-offer-one-year-dose-of-the-liberal-arts/',
        published_date: '2013-08-01',
    },
    {
        organisation: 'Mashallah News',
        article_title: 'Learning on Wings',
        article_url: 'https://www.mashallahnews.com/learning-on-wings/',
        published_date: '2015-01-01',
    },
]

export const seedPress = async (payload: Payload): Promise<void> => {
    for (const item of pressData) {
        const { article_url } = item
        await getOrCreateId(payload, 'press', { article_url: { equals: article_url } }, () =>
            payload.create({ collection: 'press', data: item, overrideAccess: true }),
        )
        console.log('press:', item.organisation)
    }
}
