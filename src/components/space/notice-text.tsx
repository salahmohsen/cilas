import type { NoticePart } from '@/lib/space-consent'

import styles from './space.module.css'

/** Privacy and rules (spec §9) as questions and answers, so each part reads on its own. */
export function NoticeText({ notice }: { notice: NoticePart[] }) {
  return (
    <dl dir="auto" className={styles.notice}>
      {notice.map((part, index) => (
        <div key={index}>
          {part.title && <dt>{part.title}</dt>}
          <dd>{part.text}</dd>
        </div>
      ))}
    </dl>
  )
}
