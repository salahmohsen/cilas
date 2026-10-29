import type { Event, PersonProfileBlock } from '@/payload-types'
import { ResolvedRichTextField } from '@/components/resolved-rich-text-field'
import { ProfileCard } from '@/components/person/profile-card'
import { eventDescription } from '@/lib/event-description'
import { plainText } from '@/lib/plaintext'
import styles from './events.module.css'

export function EventDescription({ data }: { data: NonNullable<Event['description']> }) {
  return (
    <ResolvedRichTextField
      data={eventDescription(data)}
      className="article-prose"
      blocks={{
        personProfile: ({ person }: PersonProfileBlock) => {
          if (!person || typeof person !== 'object' || !person.visible || !person.slug) return null
          const firstParagraph = person.bio?.root.children.find((node) => node.type === 'paragraph')
          const bio = person.bio
            ? plainText({
                data: firstParagraph
                  ? { root: { ...person.bio.root, children: [firstParagraph] } }
                  : person.bio,
              }).trim()
            : ''
          const preview = bio.length > 180 ? `${bio.slice(0, 180).replace(/\s+\S*$/, '')}…` : bio
          return (
            <ProfileCard person={person}>
              {preview && (
                <p className={styles.speakerBio} dir="auto">
                  {preview}
                </p>
              )}
            </ProfileCard>
          )
        },
      }}
    />
  )
}
