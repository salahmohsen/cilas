'use client'

import { Button, TextareaField, useField, useLocale } from '@payloadcms/ui'
import type { TextareaFieldClientProps } from 'payload'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/arc/badge/badge'
import { clientEnv as env } from '@/env.client'
import {
  fillPrompt,
  linkLength,
  promptProblem,
  providers,
  STUDY_VARIABLES,
  studyFiles,
  type StudyKind,
  type StudyTier,
} from '@/lib/ai-study'
import messagesAr from '../../../messages/ar.json'
import messagesEn from '../../../messages/en.json'

import './dashboard/arc-scope.css'
import styles from './study-prompt-field.module.css'

type Lang = 'en' | 'ar'

const MESSAGES = { en: messagesEn, ar: messagesAr } as const

const PROVIDER_NAMES = messagesEn.Share.providers

const useLang = (): Lang => (useLocale()?.code === 'ar' ? 'ar' : 'en')

/** A typical page of each kind, so the meter measures links like the real ones. */
const sample = (kind: StudyKind, lang: Lang) => {
  const t = MESSAGES[lang]
  const path = kind === 'article' ? 'articles/a-typical-article-address' : 'study/a-typical-course'
  return {
    ...studyFiles(env.NEXT_PUBLIC_SERVER_URL, `/${lang}/${path}`),
    course: lang === 'ar' ? 'قراءة المدينة: الذاكرة والمكان' : 'Reading the City: memory and place',
    session: lang === 'ar' ? 'الأسبوع ٣: الشارع كأرشيف' : 'Week 3: The street as an archive',
    readings: fillPrompt(t.StudyPrompt.readings, {
      list:
        lang === 'ar'
          ? 'مدن لا مرئية، إيتالو كالفينو؛ موت وحياة المدن الأمريكية الكبرى، جين جيكوبز'
          : 'Invisible Cities, Italo Calvino; The Death and Life of Great American Cities, Jane Jacobs',
    }),
  }
}

/** What the prompts of one kind are for, and their placeholders, which copy on click. */
export function StudyPromptAbout({ kind }: { kind: StudyKind }) {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token)
      setCopied(token)
    } catch {
      setCopied(null)
    }
  }
  return (
    <header className={styles.about}>
      <p className={styles.lead}>
        Each button opens the assistant with the longest of these prompts that its link can carry.
        An empty field uses the default, shown in grey.
      </p>
      <div className={styles.placeholders}>
        <span className={styles.label}>Placeholders</span>
        <div className={styles.chips}>
          {STUDY_VARIABLES[kind].map((name) => {
            const token = `{${name}}`
            return (
              <button
                key={name}
                type="button"
                className={styles.chip}
                aria-label={`Copy ${token}`}
                onClick={() => copy(token)}
              >
                {copied === token ? 'Copied' : token}
              </button>
            )
          })}
        </div>
      </div>
      <p className={styles.hint}>
        {'{pageFile}'} and {'{siteFile}'} must stay: the assistant reads the page and the site from
        them. A line that holds only an empty placeholder is left out.
      </p>
    </header>
  )
}

/**
 * One prompt: Payload's textarea with the default in the edited language as
 * its placeholder, a button that returns to it, and how long the link to
 * each assistant would be.
 */
export function StudyPromptField(
  props: TextareaFieldClientProps & { kind: StudyKind; tier: StudyTier },
) {
  const { kind, tier, ...fieldProps } = props
  const lang = useLang()
  const { value, setValue } = useField<string>({ path: props.path })
  const fallback = MESSAGES[lang].StudyPrompt[kind][tier]
  const admin = { ...props.field.admin, placeholder: fallback }
  const text = value?.trim() ? value : fallback

  const lengths = useMemo(() => {
    if (promptProblem(kind, text)) return null
    const prompt = fillPrompt(text, sample(kind, lang))
    return providers.map((p) => ({ ...p, length: linkLength(p.id, prompt) }))
  }, [kind, lang, text])

  return (
    <div className={styles.field}>
      <TextareaField {...fieldProps} field={{ ...props.field, admin }} />
      <div className={styles.toolbar}>
        {value ? (
          <Button buttonStyle="subtle" size="small" margin={false} onClick={() => setValue('')}>
            Use default
          </Button>
        ) : null}
      </div>
      {lengths ? (
        <div className={`arc-scope ${styles.meter}`} dir="ltr">
          <p className={styles.hint}>
            Link length with a typical page{value?.trim() ? '' : ' (default prompt)'}:
          </p>
          <ul className={styles.providers}>
            {lengths.map((p) => {
              const fits = p.length <= p.maxUrl
              return (
                <li key={p.id}>
                  <span className={styles.name}>{PROVIDER_NAMES[p.id]}</span>
                  <span className={styles.count}>
                    {p.length.toLocaleString('en')} / {p.maxUrl.toLocaleString('en')}
                  </span>
                  <Badge size="sm" tone={fits ? 'success' : 'warning'}>
                    {fits
                      ? 'Fits'
                      : tier === 'short'
                        ? 'Too long: cut short'
                        : 'Too long: next prompt'}
                  </Badge>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
