'use client'

import { personAvatarSeed } from '@/lib/avatar'

import { useMemo, useState, useTransition } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import {
  CommentThread,
  type CommentAuthor,
  type CommentThreadEvent,
  type CommentTopic,
  type ThreadComment as ArcComment,
  matchMentions,
  matchTopics,
} from '@/components/arc/comment-thread/comment-thread'
import {
  commentCreateAction,
  commentEditAction,
  commentRemoveAction,
  reactionToggleAction,
  type SpacesWriteState,
} from '@/lib/space-actions'
import type { NoticePart } from '@/lib/space-consent'
import { REACTION_KINDS, type ReactionKind } from '@/lib/space-reactions'
import type { ThreadComment, TopComment } from '@/lib/spaces-data'

import { REACTION_ICON } from './reaction-icons'

import { LinkedText } from './linked-text'
import { saveErrorKey } from './composer'
import { ConsentSheet } from './consent-sheet'
import { PersonHover } from './person-hover'
import type { PersonCard } from '@/lib/space-members'
import { SessionChip, useSessionName, useSessionWhen, type SessionLinks } from './session-chip'
import styles from './space.module.css'

const EMOJI: Record<ReactionKind, string> = {
  agree: '👍',
  thank_you: '❤️',
  celebrate: '🎉',
  insightful: '💡',
  same_question: '❓',
  rocket: '🚀',
}
const KIND_OF = new Map(REACTION_KINDS.map((k) => [EMOJI[k], k]))
const STORED_MENTION = /\[@([^\]]*)\]\(\/people\/(\d+)\)/g
const STORED_SESSION =
  /\[#?([^\]\n]*)\]\(session:([A-Za-z0-9_-]{1,64})\)|::session\[([A-Za-z0-9_-]{1,64})\]/g

/** In the feed, a long thread opens on its newest comments. */
const PREVIEW = 2

export type ThreadViewer = {
  personId: number | null
  moderator: boolean
  me: { name: string; photo: string | null; fallbackSeed?: string }
}

/**
 * A post's comments (spec §4), drawn by Arc's comment thread. Replies go one
 * level under a comment (maxDepth 1, the same rule commentCreate enforces);
 * a deleted comment with replies stays as a placeholder (spec §3). The
 * privacy notice comes before a member's first comment (spec §9).
 */
export function SpaceThread({
  post,
  comments,
  people,
  known,
  viewer,
  canComment,
  consented,
  notice,
  now,
  titles,
  sessions,
  preview = false,
  limit,
  step,
  focusKey,
}: {
  post: number
  comments: TopComment[]
  /** Everyone in the space, for names, cards and @mentions */
  people: PersonCard[]
  /** Everyone a comment may be by, members or not; names and photos come from here */
  known: PersonCard[]
  viewer: ThreadViewer
  /** Open, unlocked, not archived, and the posting level lets this member comment */
  canComment: boolean
  consented: boolean
  notice: NoticePart[]
  /** When the page rendered, so times read the same on server and client */
  now: string
  /** Page titles by address, for the bare links in comment text */
  titles: Record<string, string>
  /** The course sessions a comment may name with #; absent outside a course space */
  sessions?: SessionLinks | null
  /** Opens on the newest comments, with a button for the rest */
  preview?: boolean
  /** How many top-level comments show first; defaults to 2 in a preview and all otherwise */
  limit?: number
  /** How many more each "Show more" adds; without it one press shows them all */
  step?: number
  focusKey?: number
}) {
  const t = useTranslations('SpaceThread')
  const tp = useTranslations('SpacePost')
  const tr = useTranslations('SpaceReactions')
  const format = useFormatter()
  const router = useRouter()
  const [, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(limit ?? (preview ? PREVIEW : Infinity))
  const [accepted, setAccepted] = useState(consented)
  const [asking, setAsking] = useState<CommentThreadEvent | null>(null)

  const byId = useMemo(() => new Map(known.map((p) => [p.id, p])), [known])
  const me: CommentAuthor = {
    id: String(viewer.personId ?? 'me'),
    name: viewer.me.name,
    avatar: viewer.me.photo ?? undefined,
    fallbackSeed:
      viewer.me.fallbackSeed ??
      (viewer.personId != null ? personAvatarSeed(viewer.personId) : 'anonymous'),
  }
  const authors: CommentAuthor[] = useMemo(
    () =>
      people.map((p) => ({
        id: String(p.id),
        fallbackSeed: personAvatarSeed(p.id),
        name: p.name,
        avatar: p.photo ?? undefined,
      })),
    [people],
  )

  // Each session reads "#3 Title" in the text, by its current number and title.
  const { unitOf } = useSessionName()
  const whenOf = useSessionWhen()
  const topics: CommentTopic[] = Object.entries(sessions?.facts ?? {}).map(([id, fact]) => ({
    id,
    name: `${fact.n}${fact.title ? ` ${fact.title}` : ''}`,
    hint: [unitOf(fact), whenOf(fact)].filter(Boolean).join(' · '),
  }))
  const topicOf = new Map(topics.map((topic) => [topic.id, topic]))
  /** A stored session reads as "#name"; one the course dropped says so, and an unread course keeps the stored words. */
  const toShown = (body: string) =>
    body.replace(
      STORED_SESSION,
      (_, label: string | undefined, id: string | undefined, block: string | undefined) => {
        const topic = topicOf.get((id ?? block)!)
        if (topic) return `#${topic.name}`
        return sessions?.known ? tp('sessionRemoved') : `#${label || tp('sessionMention')}`
      },
    )

  const toArc = (c: ThreadComment, replies?: ThreadComment[]): ArcComment => {
    const person = c.authorId != null ? byId.get(c.authorId) : undefined
    return {
      id: String(c.id),
      author: {
        id: String(c.authorId ?? `gone-${c.id}`),
        name: person?.name ?? t('formerMember'),
        avatar: person?.photo ?? undefined,
        fallbackSeed: c.authorId != null ? personAvatarSeed(c.authorId) : 'former-member',
      },
      // Stored mentions read as "@Name", with the person's current name; the ids stay beside the text.
      body: toShown(
        c.body.replace(
          STORED_MENTION,
          (_, name: string, id: string) => `@${byId.get(Number(id))?.name ?? name}`,
        ),
      ),
      mentions: [...c.body.matchAll(STORED_MENTION)].map(([, name, id]) => {
        const person = byId.get(Number(id))
        return {
          id: id!,
          fallbackSeed: personAvatarSeed(id!),
          name: person?.name ?? name!,
          avatar: person?.photo ?? undefined,
        }
      }),
      createdAt: format.relativeTime(new Date(c.createdAt), new Date(now)),
      edited: c.edited,
      deleted: c.deleted,
      reactions: REACTION_KINDS.filter((k) => (c.reactions.counts[k] ?? 0) > 0).map((k) => {
        const count = c.reactions.counts[k] ?? 0
        const mine = c.reactions.mine.includes(k)
        // Arc counts people; the space keeps names private, so the others are placeholders.
        const others = Array.from({ length: count - (mine ? 1 : 0) }, (_, i) => `${k}-${i}`)
        return { emoji: EMOJI[k], users: mine ? [me.id, ...others] : others }
      }),
      replies: replies?.map((r) => toArc(r)),
    }
  }
  const server = comments.map((c) => toArc(c, c.replies))
  const [tree, setTree] = useState(server)
  const [seen, setSeen] = useState(comments)
  if (seen !== comments) {
    setSeen(comments)
    setTree(server)
  }

  /**
   * Each "@Name" becomes the stored link again, by the id picked in the
   * composer. A name nobody picked links only when one member has it.
   */
  const toStored = (text: string, mentions: CommentAuthor[]) => {
    const found = [
      ...matchMentions(text, mentions, authors).flatMap(({ start, end, person }) => {
        const sameName = authors.filter((a) => a.name === person.name).length
        if (!mentions.includes(person) && sameName > 1) return []
        return [
          { start, end, token: `[@${person.name.replace(/[[\]]/g, '')}](/people/${person.id})` },
        ]
      }),
      ...matchTopics(text, topics).map(({ start, end, topic }) => ({
        start,
        end,
        token: `[#${topic.name.replace(/[[\]]/g, '')}](session:${topic.id})`,
      })),
    ].sort((a, b) => a.start - b.start)
    let out = ''
    let from = 0
    for (const { start, end, token } of found) {
      if (start < from) continue
      out += `${text.slice(from, start)}${token}`
      from = end
    }
    return out + text.slice(from)
  }

  const send = (event: CommentThreadEvent) => {
    const form = new FormData()
    let action = commentCreateAction
    switch (event.type) {
      case 'reply':
        form.set('post', String(post))
        if (event.parentId) form.set('parent', event.parentId)
        form.set('body', toStored(event.comment.body, event.comment.mentions ?? []))
        break
      case 'edit':
        action = commentEditAction
        form.set('comment', event.id)
        form.set('body', toStored(event.body, event.mentions))
        break
      case 'delete':
        action = commentRemoveAction
        form.set('comment', event.id)
        break
      case 'react': {
        const kind = KIND_OF.get(event.emoji)
        if (!kind) return
        action = reactionToggleAction
        form.set('comment', event.id)
        form.set('reaction', kind)
        form.set('on', String(event.added))
        break
      }
    }
    start(async () => {
      const result = await action({ status: 'ok' }, form).catch((): SpacesWriteState => ({
        status: 'error',
        error: 'failed',
      }))
      if (result.status === 'error') {
        setTree(server)
        setError(tp(saveErrorKey(result.error)))
        return
      }
      router.refresh()
    })
  }

  const hidden = tree.slice(0, Math.max(0, tree.length - visible))
  const shown = tree.slice(hidden.length)
  // The real number of comments behind the button: replies count, a deleted placeholder does not.
  const countOf = (list: ArcComment[]) =>
    list.reduce(
      (sum, c) => sum + (c.deleted ? 0 : 1) + (c.replies?.filter((r) => !r.deleted).length ?? 0),
      0,
    )
  const hiddenCount = countOf(hidden)
  const nextCount = step ? countOf(hidden.slice(-step)) : hiddenCount
  const mine = (c: ArcComment) => c.author.id === me.id && /^\d+$/.test(c.id)

  return (
    <div className={styles.threadWrap}>
      <CommentThread
        flush
        comments={shown}
        showHeader={!preview && limit == null}
        listHeader={
          hiddenCount > 0 ? (
            <button
              type="button"
              className={styles.earlier}
              onClick={() => setVisible((n) => (step ? n + step : Infinity))}
            >
              {step
                ? t('showMore', { count: nextCount })
                : t('showEarlier', { count: hiddenCount })}
            </button>
          ) : undefined
        }
        onCommentsChange={(next, event) => {
          setError(null)
          setTree([...hidden, ...next])
          if (event.type === 'reply' && !accepted) return setAsking(event)
          send(event)
        }}
        currentUser={me}
        people={authors}
        reactions={REACTION_KINDS.map((k) => EMOJI[k])}
        renderReaction={(emoji) => {
          const Icon = REACTION_ICON[KIND_OF.get(emoji) ?? 'agree']
          return <Icon aria-hidden="true" />
        }}
        maxDepth={1}
        resolvable={false}
        canReply={canComment}
        canEdit={(c) => canComment && mine(c)}
        canDelete={(c) => /^\d+$/.test(c.id) && (mine(c) || viewer.moderator)}
        placeholder={t('placeholder')}
        nowLabel={t('now')}
        composerFocusKey={focusKey}
        inlineActions
        renderName={(author) => {
          const person = byId.get(Number(author.id))
          return person ? (
            <PersonHover person={person}>
              <button type="button" className={styles.authorButton}>
                <bdi>{author.name}</bdi>
              </button>
            </PersonHover>
          ) : (
            <bdi>{author.name}</bdi>
          )
        }}
        renderMention={(author, text) => {
          const person = byId.get(Number(author.id))
          if (!person) return text
          const chip = person.href ? (
            <a href={person.href} className={styles.mentionLink}>
              <bdi>{text}</bdi>
            </a>
          ) : (
            <button type="button" className={styles.mentionLink}>
              <bdi>{text}</bdi>
            </button>
          )
          return <PersonHover person={person}>{chip}</PersonHover>
        }}
        renderText={(text) => <LinkedText text={text} titles={titles} />}
        topics={topics}
        renderTopic={(topic, text) => <SessionChip id={topic.id} links={sessions} label={text} />}
        labels={{
          thread: t('thread'),
          commentCount: (count) => t('count', { count }),
          empty: t('empty'),
          reply: t('reply'),
          edit: t('edit'),
          delete: t('delete'),
          cancel: t('cancel'),
          send: t('send'),
          save: t('save'),
          editComment: t('editComment'),
          edited: t('edited'),
          deleteConfirm: t('deleteConfirm'),
          deletedText: t('deletedText'),
          deletedComment: t('deletedComment'),
          replyingTo: (name) => t('replyingTo', { name }),
          cancelReply: t('cancelReply'),
          showReplies: (count) => t('showReplies', { count }),
          hideReplies: t('hideReplies'),
          addReaction: t('addReaction'),
          closeReactions: t('closeReactions'),
          reactions: t('reactions'),
          reactWith: (emoji) => tr(KIND_OF.get(emoji) ?? 'agree'),
          reactionCount: (emoji, count, you) =>
            t('reactionCount', {
              reaction: tr(KIND_OF.get(emoji) ?? 'agree'),
              count,
              you: String(you),
            }),
          mentions: t('mentions'),
          topics: t('sessions'),
        }}
      />
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <ConsentSheet
        open={asking != null}
        onOpenChange={(open) => {
          if (open) return
          setAsking(null)
          setTree(server)
        }}
        notice={notice}
        onAccepted={() => {
          setAccepted(true)
          const pending = asking
          setAsking(null)
          if (pending) send(pending)
        }}
      />
    </div>
  )
}
