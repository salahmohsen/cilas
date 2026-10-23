'use client'

import { useAuth } from '@payloadcms/ui'
import { Bell } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

type Note = {
  id: number
  title: string
  description?: string | null
  link?: string | null
  read_at?: string | null
  createdAt: string
}

const API = '/api/notifications'

const ago = (iso: string) => {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours} h` : `${Math.floor(hours / 24)} d`
}

/**
 * The bell in the admin's top bar: the signed-in account's notifications
 * (src/collections/Notifications.ts), the unread ones counted. It looks again
 * every minute and when the tab comes back into view. Opening one marks it
 * read and goes to what it is about.
 */
export function NotificationBell() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [unread, setUnread] = useState(0)
  const panel = useId()
  const box = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const [list, count] = await Promise.all([
      fetch(`${API}?limit=12&depth=0&sort=-createdAt`, { credentials: 'include' }).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch(`${API}?limit=0&depth=0&where[read_at][exists]=false`, { credentials: 'include' }).then(
        (r) => (r.ok ? r.json() : null),
      ),
    ]).catch(() => [null, null])
    if (list) setNotes(list.docs as Note[])
    if (count) setUnread(count.totalDocs as number)
  }, [])

  useEffect(() => {
    if (!user) return
    // On a timer, as every later look is: the counts arrive after the first paint.
    const first = setTimeout(() => void load(), 0)
    const every = setInterval(() => void load(), 60_000)
    const back = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', back)
    return () => {
      clearTimeout(first)
      clearInterval(every)
      document.removeEventListener('visibilitychange', back)
    }
  }, [user, load])

  // Closes on a click outside or Escape.
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  if (!user) return null

  const go = async (note: Note) => {
    if (!note.read_at) {
      await fetch(`${API}/${note.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read_at: new Date().toISOString() }),
      }).catch(() => null)
    }
    if (note.link) window.location.assign(note.link)
    else void load()
  }
  const readAll = async () => {
    await fetch(`${API}/read-all`, { method: 'POST', credentials: 'include' }).catch(() => null)
    void load()
  }

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button
        aria-controls={panel}
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          width: 34,
          height: 34,
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 999,
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
        }}
        type="button"
      >
        <Bell aria-hidden size={16} />
        {unread ? (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: -4,
              insetInlineEnd: -4,
              minWidth: 18,
              height: 18,
              borderRadius: 999,
              padding: '0 5px',
              background: 'var(--theme-error-500, #dc2626)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              lineHeight: '18px',
              textAlign: 'center',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          id={panel}
          role="dialog"
          aria-label="Notifications"
          style={{
            position: 'absolute',
            insetInlineEnd: 0,
            top: 42,
            zIndex: 100,
            width: 'min(360px, calc(100vw - 32px))',
            maxHeight: 440,
            overflow: 'auto',
            border: '1px solid var(--theme-elevation-150)',
            borderRadius: 8,
            background: 'var(--theme-elevation-0)',
            boxShadow: '0 12px 32px -8px rgb(0 0 0 / 0.35)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 14px',
              borderBottom: '1px solid var(--theme-elevation-100)',
            }}
          >
            <strong>Notifications</strong>
            {unread ? (
              <button
                onClick={readAll}
                style={{
                  border: 0,
                  background: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
                type="button"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          {notes.length ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {notes.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => void go(n)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '8px 1fr auto',
                      gap: 10,
                      alignItems: 'baseline',
                      width: '100%',
                      padding: '10px 14px',
                      border: 0,
                      borderBottom: '1px solid var(--theme-elevation-100)',
                      background: 'none',
                      color: 'inherit',
                      textAlign: 'start',
                      cursor: 'pointer',
                    }}
                    type="button"
                  >
                    <span
                      aria-label={n.read_at ? undefined : 'Unread'}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: n.read_at ? 'transparent' : 'var(--theme-success-500, #16a34a)',
                      }}
                    />
                    <span dir="auto" style={{ fontWeight: n.read_at ? 400 : 600 }}>
                      {n.title}
                      {n.description ? (
                        <span
                          dir="auto"
                          style={{
                            display: 'block',
                            fontSize: 12,
                            fontWeight: 400,
                            color: 'var(--theme-elevation-500)',
                            marginTop: 2,
                          }}
                        >
                          {n.description}
                        </span>
                      ) : null}
                    </span>
                    <span style={{ color: 'var(--theme-elevation-500)', fontSize: 12 }}>
                      {ago(n.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, padding: '16px 14px', color: 'var(--theme-elevation-500)' }}>
              Nothing yet.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
