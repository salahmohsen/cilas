'use client'

import { useDeferredValue, useState } from 'react'
import { useTranslations } from 'next-intl'

import { Avatar } from '@/components/arc/avatar/avatar'
import { AvatarGroup } from '@/components/arc/avatar-group/avatar-group'
import { Button } from '@/components/arc/button/button'
import { Drawer, DrawerContent } from '@/components/arc/drawer/drawer'
import { SearchField } from '@/components/arc/search-field/search-field'

import { PersonHover, type PersonCard } from './person-hover'
import styles from './space.module.css'

/**
 * Who belongs (spec §1): a few faces, each with its card, and the full list in
 * a drawer. Members see names and photos only, never email (spec §1, People).
 */
export function MembersPanel({
  members,
  viewerId,
}: {
  /** Fellows first, then by name. */
  members: PersonCard[]
  viewerId: number | null
}) {
  const t = useTranslations('Spaces')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const needle = useDeferredValue(query).trim().toLocaleLowerCase()
  const shown = needle
    ? members.filter((m) => m.name.toLocaleLowerCase().includes(needle))
    : members
  return (
    <>
      <AvatarGroup
        members={members.map((m) => ({ id: m.id, name: m.name, src: m.photo ?? undefined }))}
        max={8}
        label={t('membersLabel')}
        wrap={(member, face) => {
          const person = members.find((m) => m.id === member.id)
          return person ? <PersonHover person={person}>{face}</PersonHover> : face
        }}
        onOverflowClick={() => setOpen(true)}
      />
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {t('seeAllMembers')}
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent
          title={t('members')}
          description={t('membersCount', { count: members.length })}
        >
          <div className={styles.column}>
            <SearchField
              label={t('searchMembers')}
              labelHidden
              placeholder={t('searchMembers')}
              value={query}
              onValueChange={setQuery}
              clearLabel={t('clearSearch')}
            />
            {shown.length === 0 ? (
              <p className={styles.meta}>{t('noMemberMatch')}</p>
            ) : (
              <ul className={styles.people}>
                {shown.map((m) => (
                  <li key={m.id} className={styles.person}>
                    <Avatar name={m.name} src={m.photo ?? undefined} size="md" />
                    <span className={styles.rowText}>
                      <span className={styles.personName}>
                        <PersonHover person={m}>
                          <button type="button" className={styles.authorButton}>
                            <bdi>{m.name}</bdi>
                          </button>
                        </PersonHover>
                        {m.id === viewerId && <span className={styles.meta}>{t('you')}</span>}
                      </span>
                      <span className={styles.meta}>{m.role}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
