import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import {
  STUDY_KINDS,
  STUDY_PROMPTS_TAG,
  STUDY_TIERS,
  type StudyKind,
  type StudyTier,
} from './ai-study'

type Saved = Partial<Record<StudyKind, Partial<Record<StudyTier, string | null>> | null>>
type Prompts = Record<StudyKind, Record<StudyTier, string>>

const read = unstable_cache(
  async (locale: string): Promise<Saved> => {
    const payload = await getPayload({ config })
    return (await payload.findGlobal({
      slug: 'study-prompts',
      locale: locale as 'en' | 'ar',
      fallbackLocale: false,
      depth: 0,
      overrideAccess: true,
    })) as Saved
  },
  [STUDY_PROMPTS_TAG],
  { tags: [STUDY_PROMPTS_TAG] },
)

/**
 * The page language's messages, with each study prompt an admin saved in
 * Admin → AI → Study prompts in place of the default. An empty field keeps
 * the default from the messages file.
 */
export async function withSavedPrompts<M extends { StudyPrompt: Prompts }>(
  messages: M,
  locale: string,
): Promise<M> {
  let saved: Saved
  try {
    saved = await read(locale)
  } catch {
    // A build without a database, or before the migration: the defaults stand.
    return messages
  }
  const prompts = structuredClone(messages.StudyPrompt)
  for (const kind of STUDY_KINDS)
    for (const tier of STUDY_TIERS) {
      const text = saved[kind]?.[tier]?.trim()
      if (text) prompts[kind][tier] = text
    }
  return { ...messages, StudyPrompt: prompts }
}
