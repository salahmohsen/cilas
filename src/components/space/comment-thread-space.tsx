import { getTranslations } from 'next-intl/server'
import { Paperclip } from 'lucide-react'

import type { MentionPerson } from '@/components/arc/mention-input/mention-input'
import type { SpaceFileRef, ThreadComment, TopComment } from '@/lib/spaces-data'

import { CommentBody } from './comment-body'
import { CommentActions, CommentComposer } from './comment-controls'
import { FeedReactions } from './feed-reactions'
import { Byline, type Person } from './feed-row'
import styles from './space.module.css'
import { When } from './when'

type Viewer = { personId: number | null; moderator: boolean }

/** A private file as a download link with its size. */
export function FileChip({ file }: { file: SpaceFileRef }) {
  return (
    <a href={file.url} className={styles.fileChip} download={file.name}>
      <Paperclip size={14} aria-hidden="true" />
      <bdi>{file.name}</bdi>
      <span className={styles.meta}>{Math.max(1, Math.round(file.size / 1024))} KB</span>
    </a>
  )
}

/**
 * A post's comments (spec §4): comments in order, each with its replies one
 * level below. A deleted comment that has replies keeps its place as a
 * placeholder, so the replies still read in context (spec §3).
 */
export async function CommentThread({
  post,
  comments,
  viewer,
  moderators,
  people,
  canComment,
  consented,
  notice,
}: {
  post: number
  comments: TopComment[]
  viewer: Viewer
  moderators: Set<number>
  people: Map<number, Person>
  /** Open, unlocked, not archived, and the posting level lets this member comment */
  canComment: boolean
  consented: boolean
  notice: string
}) {
  const [t, tp] = await Promise.all([getTranslations('SpaceComment'), getTranslations('SpacePost')])
  const names = Object.fromEntries([...people].map(([id, p]) => [id, p.name]))
  const suggestions: MentionPerson[] = [...people].map(([id, p]) => ({
    id: String(id),
    name: p.name,
    avatar: p.photo ?? undefined,
  }))
  const labels = {
    agree: tp('reaction_agree'),
    thank_you: tp('reaction_thank_you'),
    insightful: tp('reaction_insightful'),
    same_question: tp('reaction_same_question'),
  }

  const item = (c: ThreadComment) => {
    const id = `comment-${c.id}`
    if (c.deleted)
      return (
        <p id={id} className={`${styles.meta} ${styles.comment}`}>
          {t('deleted')}
        </p>
      )
    const mine = c.authorId != null && c.authorId === viewer.personId
    return (
      <article id={id} className={styles.comment} aria-labelledby={`${id}-author`}>
        <header className={styles.postHead}>
          <Byline
            personId={c.authorId}
            name={null}
            labelId={`${id}-author`}
            people={people}
            moderators={moderators}
          />
          <When iso={c.createdAt} className={styles.meta} />
          {c.edited && <span className={styles.meta}>{tp('edited')}</span>}
          <span className={styles.postActions}>
            <CommentActions
              comment={{ id: c.id, body: c.body }}
              people={suggestions}
              canEdit={mine && canComment}
              canDelete={mine || viewer.moderator}
            />
          </span>
        </header>
        <CommentBody body={c.body} people={names} />
        {c.file && (
          <div>
            <FileChip file={c.file} />
          </div>
        )}
        <FeedReactions
          target={{ comment: c.id }}
          counts={c.reactions.counts}
          mine={c.reactions.mine}
          disabled={!canComment}
          labels={labels}
        />
      </article>
    )
  }

  return (
    <section className={styles.column} aria-labelledby="comments-title">
      <h2 id="comments-title" className={styles.sectionTitle}>
        {tp('comments', {
          count: comments.flatMap((c) => [c, ...c.replies]).filter((c) => !c.deleted).length,
        })}
      </h2>
      {comments.length > 0 && (
        <ol className={styles.thread}>
          {comments.map((c) => (
            <li key={c.id} className={styles.column}>
              {item(c)}
              {(c.replies.length > 0 || (canComment && !c.deleted)) && (
                <ol className={styles.replies}>
                  {c.replies.map((r) => (
                    <li key={r.id}>{item(r)}</li>
                  ))}
                  {canComment && !c.deleted && (
                    <li>
                      <CommentComposer
                        post={post}
                        parent={c.id}
                        people={suggestions}
                        consented={consented}
                        notice={notice}
                      />
                    </li>
                  )}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}
      {canComment && (
        <CommentComposer post={post} people={suggestions} consented={consented} notice={notice} />
      )}
    </section>
  )
}
