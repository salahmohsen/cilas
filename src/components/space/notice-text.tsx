import type { NoticePart } from '@/lib/space-consent'

import styles from './space.module.css'

/** The privacy notice (spec §9) as questions and answers, so each part reads on its own. */
export function NoticeText({ notice }: { notice: NoticePart[] }) {
  return (
    <dl dir="auto" className={styles.notice}>
      {notice.map((part) => (
        <div key={part.title}>
          <dt>{part.title}</dt>
          <dd>{part.text}</dd>
        </div>
      ))}
    </dl>
  )
}
