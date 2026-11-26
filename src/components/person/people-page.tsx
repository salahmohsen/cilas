import { PeopleWheel, type WheelPerson } from '@/components/person/people-wheel'
import styles from './people-page.module.css'

export function PeoplePage({
  title,
  intro,
  count,
  people,
  namespace,
}: {
  title: string
  intro: string
  count: string
  people: WheelPerson[]
  namespace: 'Fellows' | 'Cilasians' | 'Governance'
}) {
  return (
    <div className="page-frame py-12 sm:py-16">
      <header className="max-w-2xl">
        <h1 className={`${styles.heading} font-semibold`}>{title}</h1>
        <p className="mt-4 text-lg text-(--text-secondary)">{intro}</p>
        <p className="mt-2 text-sm text-(--text-muted)">{count}</p>
      </header>
      <div className="mt-10">
        <PeopleWheel namespace={namespace} people={people} />
      </div>
    </div>
  )
}
