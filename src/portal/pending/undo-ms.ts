const DEFAULT_UNDO_MS = 5000

export function undoMsFromEnv(): number {
  const raw = process.env.NEXT_PUBLIC_PORTAL_UNDO_MS
  const ms = raw && /^\d+$/.test(raw) ? Number(raw) : DEFAULT_UNDO_MS
  return ms >= 500 && ms <= DEFAULT_UNDO_MS ? ms : DEFAULT_UNDO_MS
}
