import type { Payload } from 'payload'
import type { SiteSettingsSeed } from '../seed.type'
import { lexical } from '../seed.utils'

export const siteSettingsData: SiteSettingsSeed = {
    site_title: 'Cairo Institute of Liberal Arts and Sciences',
    contact_emails: { admissions: 'admissions@ci-las.org', info: 'info@ci-las.org' },
    social_links: [
        { platform: 'facebook', url: 'https://www.facebook.com/cilasian' },
        { platform: 'twitter', url: 'https://twitter.com/CILASian' },
        { platform: 'youtube', url: 'http://www.youtube.com/channel/UCPDXrYj4ok4oslkuGROHsxA' },
    ],
    footer_text: 'CILAS invites students from all walks of life to engage with the liberal arts.',
    support_us: 'Support CILAS by contributing to the Scholarship Programme.',
}

/** Globals have no create — `updateGlobal` is idempotent by nature. */
export const seedSiteSettings = async (payload: Payload): Promise<void> => {
    const { footer_text, support_us, ...rest } = siteSettingsData

    await payload.updateGlobal({
        slug: 'site-settings',
        data: {
            ...rest,
            footer_text: footer_text ? lexical(footer_text) : null,
            support_us: support_us ? lexical(support_us) : null,
        },
        overrideAccess: true,
    })
    console.log('site-settings updated')
}
