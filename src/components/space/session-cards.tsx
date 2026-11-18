import {
  BookOpen,
  Clapperboard,
  FileText,
  Headphones,
  MapPin,
  MessageCircleQuestion,
  MessagesSquare,
  PencilLine,
  Play,
  Presentation,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import type { useTranslations } from 'next-intl'

import { Input } from '@/components/arc/input/input'
import { Select } from '@/components/arc/select/select'
import { Textarea } from '@/components/arc/textarea/textarea'
import { ACTIVITY_KINDS } from '@/fields/activities'
import { MATERIAL_TYPES } from '@/fields/bibliography'
import type { SessionEdit } from '@/lib/session-edit'

import type { CardIssues, CardKind } from './card-list'

type Material = SessionEdit['bibliography'][number] & { key: string }
type Activity = SessionEdit['activities'][number] & { key: string }

type Words = {
  t: ReturnType<typeof useTranslations<'SessionEdit'>>
  tc: ReturnType<typeof useTranslations<'Course'>>
  dir: 'ltr' | 'rtl'
}

const MATERIAL_ICONS: Record<Material['type'], LucideIcon> = {
  reading: BookOpen,
  watch: Play,
  listen: Headphones,
  prompt: MessageCircleQuestion,
  other: FileText,
}
const ACTIVITY_ICONS: Record<Activity['kind'], LucideIcon> = {
  discussion: MessagesSquare,
  field_visit: MapPin,
  exercise: PencilLine,
  screening: Clapperboard,
  presentation: Presentation,
  other: Sparkles,
}

const hostOf = (href: string) => {
  try {
    return new URL(href).hostname.replace(/^www\./, '')
  } catch {
    return href
  }
}
const isLink = (href: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(href).protocol)
  } catch {
    return false
  }
}

/** A material needs a title or a link, and a link must be a whole web address. */
export const materialIssues = (m: Pick<Material, 'title' | 'href'>) => {
  const issues: { title?: 'material'; href?: 'link' } = {}
  const href = m.href.trim()
  if (!m.title.trim() && !href) issues.title = 'material'
  if (href && !isLink(href)) issues.href = 'link'
  return issues
}

const editWords = ({ t }: Words, of: 'material' | 'activity') => ({
  edit: (title: string) => t(of === 'material' ? 'editMaterial' : 'editActivity', { title }),
  add: t(of === 'material' ? 'addMaterial' : 'addActivity'),
  addTitle: t(of === 'material' ? 'addMaterial' : 'addActivity'),
  editTitle: t(of === 'material' ? 'materialTitleEdit' : 'activityTitleEdit'),
  remove: t(of === 'material' ? 'removeMaterial' : 'removeActivity'),
  cancel: t('cancel'),
  done: t('done'),
  close: t('leaveClose'),
  moveUp: t('moveUp'),
  moveDown: t('moveDown'),
  position: (n: number, total: number) => t('position', { n, total }),
})

export const materialKind = (words: Words): CardKind<Material> => {
  const { t, tc, dir } = words
  return {
    blank: () => ({ type: 'reading', title: '', href: '', note: '' }),
    face: (m, n) => {
      const type = tc(`materialTypes.${m.type}`)
      const host = m.href.trim() ? hostOf(m.href.trim()) : ''
      const title = m.title.trim() || m.note.trim() || host || t('materialUntitled', { type, n })
      const line = host && host !== title ? host : m.title.trim() ? m.note.trim() : ''
      return { icon: MATERIAL_ICONS[m.type], title, line }
    },
    issues: (m) => {
      const found = materialIssues(m)
      const out: CardIssues = {}
      if (found.title) out.title = t(`errors.${found.title}`)
      if (found.href) out.href = t(`errors.${found.href}`)
      return out
    },
    fields: (m, set, issues) => (
      <>
        <Select
          label={t('materialType')}
          value={m.type}
          onValueChange={(type) => set({ type: type as Material['type'] })}
          options={MATERIAL_TYPES.map((value) => ({
            value,
            label: tc(`materialTypes.${value}`),
          }))}
        />
        <Input
          label={t('materialTitle')}
          dir={dir}
          value={m.title}
          error={issues.title}
          onChange={(e) => set({ title: e.target.value })}
        />
        <Input
          label={t('materialNote')}
          dir={dir}
          value={m.note}
          onChange={(e) => set({ note: e.target.value })}
        />
        <Input
          label={t('materialLink')}
          type="url"
          inputMode="url"
          placeholder="https://"
          dir="ltr"
          value={m.href}
          error={issues.href}
          onChange={(e) => set({ href: e.target.value })}
        />
      </>
    ),
    words: editWords(words, 'material'),
  }
}

export const activityKind = (words: Words): CardKind<Activity> => {
  const { t, tc, dir } = words
  return {
    blank: () => ({ kind: 'discussion', description: '' }),
    face: (a) => {
      const title = tc(`activityKinds.${a.kind}`)
      const line = a.description.trim().split('\n')[0] ?? ''
      return { icon: ACTIVITY_ICONS[a.kind], title, line, name: line ? `${title}, ${line}` : title }
    },
    issues: () => ({}),
    fields: (a, set) => (
      <>
        <Select
          label={t('activityKind')}
          value={a.kind}
          onValueChange={(kind) => set({ kind: kind as Activity['kind'] })}
          options={ACTIVITY_KINDS.map((value) => ({
            value,
            label: tc(`activityKinds.${value}`),
          }))}
        />
        <Textarea
          label={t('activityDescription')}
          dir={dir}
          rows={3}
          value={a.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </>
    ),
    words: editWords(words, 'activity'),
  }
}
