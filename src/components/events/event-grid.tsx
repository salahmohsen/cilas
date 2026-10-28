import type { Event } from '@/payload-types'
import { PublicEventCard } from './public-event-card'
import styles from './events.module.css'

export function EventGrid({ events, now }: { events: Event[]; now: Date }) {
  return (
    <ul className={styles.grid}>
      {events.map((event) => (
        <li key={event.id}>
          <PublicEventCard event={event} now={now} />
        </li>
      ))}
    </ul>
  )
}
