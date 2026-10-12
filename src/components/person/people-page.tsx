import { PeopleWheel, type WheelPerson } from '@/components/person/people-wheel'

/** A people page: its title, a line about who they are, how many, and the wheel. */
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
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-8 sm:py-16 xl:px-0">
      <header className="max-w-2xl">
        <h1 className="text-[clamp(2rem,4.2vw,3.1rem)] leading-[1.08] font-semibold tracking-[-0.02em] rtl:leading-[1.3] rtl:tracking-normal">
          {title}
        </h1>
        <p className="mt-4 text-lg text-[var(--text-secondary)]">{intro}</p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{count}</p>
      </header>
      <div className="mt-10">
        <PeopleWheel namespace={namespace} people={people} />
      </div>
    </div>
  )
}
