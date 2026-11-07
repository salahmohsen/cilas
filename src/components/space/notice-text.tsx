import type { NoticePart } from '@/lib/space-consent'

import styles from './space.module.css'

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
