// @vitest-environment node
// Server-side: touches the database and signs a JWT on login, which needs node
// crypto. The default jsdom environment fails with "payload must be an instance
// of Uint8Array" inside jose.
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { DEFAULT_PASSWORD, getOrCreateUser, lexical } from '../../seed/seed.utils'
import type { UserSeed } from '../../seed/seed.type'

/**
 * Regression cover for the seeder's localized user fields.
 *
 * `getOrCreateUser` only creates. Before `seedUsers` started issuing its own
 * English update, an account created before `name`/`bio` became localized kept
 * a null English name forever — 36 of 38 rows in the dev database had one.
 *
 * Needs a reachable DATABASE_URL; the assertions read through the local API, so
 * they are skipped rather than faked if the database is unavailable.
 */

const EMAIL = 'seed-locale-probe@cilas.test'

const probe = {
    name: 'Probe Fellow',
    name_ar: 'زميل الاختبار',
    email: EMAIL,
    bio: 'English bio.',
    bio_ar: 'سيرة ذاتية بالعربية.',
    roles: ['member'],
} satisfies UserSeed

let payload: Payload

const read = (id: number) =>
    payload.findByID({ collection: 'users', id, depth: 0, locale: 'all', overrideAccess: true })

/** The two locale passes `seedUsers` performs on every run. */
const applyLocalePasses = async (id: number, seed: UserSeed) => {
    await payload.update({
        collection: 'users',
        id,
        data: { name: seed.name, bio: lexical(seed.bio), roles: seed.roles },
        overrideAccess: true,
    })
    await payload.update({
        collection: 'users',
        id,
        data: { name: seed.name_ar, bio: lexical(seed.bio_ar, 'rtl') },
        locale: 'ar',
        overrideAccess: true,
    })
}

const bioText = (bio: unknown): string => {
    const root = (bio as { root?: { children?: Array<{ children?: Array<{ text?: string }> }> } })?.root
    return root?.children?.[0]?.children?.[0]?.text ?? ''
}

describe('seed localization', () => {
    let userId: number

    beforeAll(async () => {
        payload = await getPayload({ config: await config })
        userId = await getOrCreateUser(payload, probe)
    })

    afterAll(async () => {
        await payload.delete({ collection: 'users', id: userId, overrideAccess: true })
        await payload.destroy()
    })

    it('writes both name and bio, in English and Arabic', async () => {
        await applyLocalePasses(userId, probe)
        const user = (await read(userId)) as unknown as {
            name: { en: string; ar: string }
            bio: { en: unknown; ar: unknown }
        }

        expect(user.name.en).toBe(probe.name)
        expect(user.name.ar).toBe(probe.name_ar)
        expect(bioText(user.bio.en)).toBe(probe.bio)
        expect(bioText(user.bio.ar)).toBe(probe.bio_ar)
    })

    it('marks the Arabic bio as rtl so Lexical renders the direction', async () => {
        await applyLocalePasses(userId, probe)
        const user = (await read(userId)) as unknown as {
            bio: { ar: { root: { direction: string } } }
        }

        expect(user.bio.ar.root.direction).toBe('rtl')
    })

    it('refreshes English on an existing account, not just on create', async () => {
        // Simulate a row written before the field was localized: English wiped,
        // Arabic still present.
        await payload.update({
            collection: 'users',
            id: userId,
            data: { name: null },
            overrideAccess: true,
        })
        expect(((await read(userId)) as unknown as { name: { en: string } }).name.en).toBeNull()

        await applyLocalePasses(userId, probe)
        const user = (await read(userId)) as unknown as { name: { en: string } }

        expect(user.name.en).toBe(probe.name)
    })

    it('leaves the password alone when refreshing an existing account', async () => {
        // The locale passes must never send `password`, or a real account's
        // credentials get reset on every seed. The probe was created with
        // DEFAULT_PASSWORD, so that password must still log in afterwards.
        await applyLocalePasses(userId, { ...probe, password: 'a-brand-new-password' })

        const result = await payload.login({
            collection: 'users',
            data: { email: EMAIL, password: DEFAULT_PASSWORD },
        })

        expect(result.user?.email).toBe(EMAIL)
    })
})
