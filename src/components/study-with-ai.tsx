'use client'

import { siClaude, siGooglegemini } from 'simple-icons'
import { useTranslations } from 'next-intl'
import React from 'react'

import {
  ExpandingButtonGroup,
  type ExpandingButtonGroupItem,
} from '@/components/arc/expanding-button-group/expanding-button-group'
import { aiLink, providers, type ProviderId } from '@/lib/ai-study'

/** ChatGPT's mark. Simple Icons dropped OpenAI's on request; an old release still carried it. */
const CHATGPT_PATH =
  'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z'

/** Grok's mark, two strokes on a square grid, as svgl carries it. */
const GROK_VIEWBOX = '0 0 1024 1024'
const GROK_PATHS = [
  'M395.479 633.828L735.91 381.105C752.599 368.715 776.454 373.548 784.406 392.792C826.26 494.285 807.561 616.253 724.288 699.996C641.016 783.739 525.151 802.104 419.247 760.277L303.556 814.143C469.49 928.202 670.987 899.995 796.901 773.282C896.776 672.843 927.708 535.937 898.785 412.476L899.047 412.739C857.105 231.37 909.358 158.874 1016.4 10.6326C1018.93 7.11771 1021.47 3.60279 1024 0L883.144 141.651V141.212L395.392 633.916',
  'M325.226 695.251C206.128 580.84 226.662 403.776 328.285 301.668C403.431 226.097 526.549 195.254 634.026 240.596L749.454 186.994C728.657 171.88 702.007 155.623 671.424 144.2C533.19 86.9942 367.693 115.465 255.323 228.382C147.234 337.081 113.244 504.215 171.613 646.833C215.216 753.423 143.739 828.818 71.7385 904.916C46.2237 931.893 20.6216 958.87 0 987.429L325.139 695.339',
]

/** A brand's mark, one colour like the line icons besides it. */
function BrandMark({ viewBox, paths }: { viewBox: string; paths: string[] }) {
  return (
    <svg aria-hidden fill="currentColor" height={16} viewBox={viewBox} width={16}>
      {paths.map((d) => (
        <path d={d} key={d.slice(0, 24)} />
      ))}
    </svg>
  )
}

const iconOf: Record<ProviderId, React.ReactNode> = {
  claude: <BrandMark paths={[siClaude.path]} viewBox="0 0 24 24" />,
  gemini: <BrandMark paths={[siGooglegemini.path]} viewBox="0 0 24 24" />,
  grok: <BrandMark paths={GROK_PATHS} viewBox={GROK_VIEWBOX} />,
  chatgpt: <BrandMark paths={[CHATGPT_PATH]} viewBox="0 0 24 24" />,
}

/**
 * Studying this page with AI, beside the share bar: Claude, Gemini, Grok
 * and ChatGPT. Arc's expanding button group again — the same pill sharing uses, its
 * labels revealing as they're pointed at. An action opens the assistant in a
 * new tab, its prompt prefilled and asking it to fetch this page and take it
 * as the course's or the article's own material.
 */
export function StudyWithAI({ kind, path }: { kind: 'course' | 'article'; path: string }) {
  const t = useTranslations('Share')

  const items: ExpandingButtonGroupItem[] = providers.map((p) => ({
    id: p.id,
    icon: iconOf[p.id],
    label: t(`providers.${p.id}`),
    onSelect: () => {
      const url = `${window.location.origin}${path}`
      window.open(aiLink(p.id, kind, url), '_blank', 'noopener,noreferrer')
      return true
    },
  }))

  return <ExpandingButtonGroup items={items} label={t(kind === 'course' ? 'ai' : 'aiArticle')} size="md" />
}
