'use client'

import { BookOpen, FileDown, Link2, Mail, Share2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSyncExternalStore } from 'react'
import { siFacebook, siTelegram, siWhatsapp, siX } from 'simple-icons'

import { BrandMark } from '@/components/brand-mark'
import {
  ExpandingButtonGroup,
  type ExpandingButtonGroupItem,
} from '@/components/arc/expanding-button-group/expanding-button-group'
import { openNewTab } from '@/lib/open-new-tab'

/** A file the page offers beside sharing: a PDF to download, or a print edition to see. */
export type ShareFile = { href: string; label: string; kind: 'pdf' | 'print' }
const FILE_ICONS = { pdf: FileDown, print: BookOpen }

const noSubscribe = () => () => {}
const hasShareSheet = () =>
  typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches

/**
 * Sharing a page: copying its link, sending it to WhatsApp, Facebook, X,
 * Telegram or an email, and its file when it has one. Each action shows its
 * name as it's pointed at; copying the link turns its icon into a check. On a
 * phone that has a share sheet, the sheet stands in for the apps.
 */
export function ShareBar({
  path,
  title,
  label,
  file,
  email,
}: {
  /** The page's path, `/en/study/…`: the address is made from wherever the site is served. */
  path: string
  title: string
  /** The group's accessible name, such as "Share this course". */
  label: string
  file?: ShareFile
  /** The institute's info address (Site settings), the mail share's recipient. Empty: an unaddressed mail. */
  email?: string | null
}) {
  const t = useTranslations('Share')
  // Known only in the browser: the server renders the apps, and on a phone
  // with a share sheet the sheet takes over once hydrated.
  const sheet = useSyncExternalStore(noSubscribe, hasShareSheet, () => false)

  const url = () => `${window.location.origin}${path}`
  const encoded = () => encodeURIComponent(url())
  const text = encodeURIComponent(title)

  const items: ExpandingButtonGroupItem[] = [
    {
      id: 'copy',
      label: t('copyLink'),
      doneLabel: t('copied'),
      icon: <Link2 />,
      onSelect: () =>
        navigator.clipboard
          .writeText(url())
          .then(() => true)
          .catch(() => false),
    },
    ...(sheet
      ? [
          {
            id: 'share',
            label: t('share'),
            icon: <Share2 />,
            onSelect: () => {
              navigator.share({ title, url: url() }).catch(() => {})
            },
          },
        ]
      : [
          {
            id: 'whatsapp',
            label: t('whatsapp'),
            icon: <BrandMark paths={[siWhatsapp.path]} />,
            onSelect: () => openNewTab(`https://wa.me/?text=${text}%20${encoded()}`),
          },
          {
            id: 'facebook',
            label: t('facebook'),
            icon: <BrandMark paths={[siFacebook.path]} />,
            onSelect: () => openNewTab(`https://www.facebook.com/sharer/sharer.php?u=${encoded()}`),
          },
          {
            id: 'x',
            label: t('x'),
            icon: <BrandMark paths={[siX.path]} />,
            onSelect: () => openNewTab(`https://x.com/intent/post?text=${text}&url=${encoded()}`),
          },
          {
            id: 'telegram',
            label: t('telegram'),
            icon: <BrandMark paths={[siTelegram.path]} />,
            onSelect: () => openNewTab(`https://t.me/share/url?url=${encoded()}&text=${text}`),
          },
          {
            id: 'email',
            label: t('email'),
            icon: <Mail />,
            onSelect: () => {
              window.location.href = `mailto:${email ?? ''}?subject=${text}&body=${encoded()}`
            },
          },
        ]),
    ...(file
      ? [
          {
            id: 'file',
            label: file.label,
            icon: (() => {
              const Icon = FILE_ICONS[file.kind]
              return <Icon />
            })(),
            onSelect: () => openNewTab(file.href),
          },
        ]
      : []),
  ]

  return <ExpandingButtonGroup items={items} label={label} size="md" />
}
