'use client'

import { toast, useAuth, useConfig, useTranslation } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useRef } from 'react'

import { DIALOG_DELETE, type DialogDeleteSlug, useDeleteDialog } from './delete-dialog'

const CELL_CLASS = 'pt-actions-cell'
const ARM_TIMEOUT = 2600
const PENCIL_SVG =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>'
const TRASH_SVG =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>'

/**
 * The list rows' Edit and Delete buttons, in place of payload-theme's
 * ListQuickActions (swapped in src/payload.config.ts). The theme's version
 * shows Delete on every row and calls the stock REST delete, so a collection
 * whose delete is closed got "An unknown error has occurred". Here Delete
 * shows only where the user may delete, and a space or a course opens the
 * delete dialog (what goes with it, and a name check) instead of the stock
 * delete.
 * Same markup and classes as the theme, so its styles apply.
 */
export function ListRowActions({ children }: { children?: ReactNode }) {
  const { config } = useConfig()
  const { permissions } = useAuth()
  const { t } = useTranslation()
  const router = useRouter()
  const dialogDelete = useDeleteDialog(() => router.refresh())
  // The decorator reads the dialog through a ref so it does not rebuild the
  // cells each time the dialog's state changes.
  const openDialogDelete = useRef(dialogDelete.open)
  openDialogDelete.current = dialogDelete.open

  useEffect(() => {
    const apiBase = `${config.serverURL || ''}${config.routes.api}`
    const canDelete = (slug: string) =>
      Boolean(
        (permissions?.collections as Record<string, { delete?: unknown }> | undefined)?.[slug]
          ?.delete,
      )

    const deleteDoc = async (slug: string, id: string) => {
      try {
        const res = await fetch(`${apiBase}/${slug}/${encodeURIComponent(id)}`, {
          credentials: 'include',
          method: 'DELETE',
        })
        if (!res.ok) throw new Error('delete failed')
        toast.success(t('general:deletedSuccessfully'))
        router.refresh()
      } catch {
        toast.error(t('error:unknown'))
      }
    }

    const trashButton = () => {
      const del = document.createElement('button')
      del.type = 'button'
      del.className = 'pt-actions__btn pt-actions__btn--danger'
      del.title = t('general:delete')
      del.setAttribute('aria-label', t('general:delete'))
      del.innerHTML = TRASH_SVG
      return del
    }

    const buildCell = (row: Element) => {
      const td = document.createElement('td')
      td.className = CELL_CLASS
      const href = row.querySelector('a[href*="/collections/"]')?.getAttribute('href') ?? ''
      const match =
        href && !href.includes('/trash/')
          ? /\/collections\/([^/]+)\/([^/?#]+)\/?$/.exec(href)
          : null
      if (!match) return td // spacer keeps the column aligned
      const [, slug, encodedID] = match
      const id = decodeURIComponent(encodedID)

      const edit = document.createElement('a')
      edit.className = 'pt-actions__btn'
      edit.href = href
      edit.title = t('general:edit')
      edit.setAttribute('aria-label', t('general:edit'))
      edit.innerHTML = PENCIL_SVG
      edit.addEventListener('click', (event) => {
        // plain left-click → client navigation; modified clicks keep native behaviour
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        router.push(href)
      })
      td.append(edit)

      if ((DIALOG_DELETE as readonly string[]).includes(slug)) {
        // The stock delete is closed here; the dialog checks who may delete.
        const del = trashButton()
        del.addEventListener(
          'click',
          () => void openDialogDelete.current(slug as DialogDeleteSlug, id),
        )
        td.append(del)
        return td
      }
      if (!canDelete(slug)) return td

      const del = trashButton()
      let disarm: ReturnType<typeof setTimeout> | undefined
      del.addEventListener('click', () => {
        if (del.classList.contains('pt-actions__btn--armed')) {
          if (disarm) clearTimeout(disarm)
          del.disabled = true
          void deleteDoc(slug, id)
          return
        }
        del.classList.add('pt-actions__btn--armed')
        del.textContent = `${t('general:delete')}?`
        disarm = setTimeout(() => {
          del.classList.remove('pt-actions__btn--armed')
          del.innerHTML = TRASH_SVG
        }, ARM_TIMEOUT)
      })
      td.append(del)
      return td
    }

    const decorate = () => {
      document.querySelectorAll('.collection-list .table > table').forEach((tableEl) => {
        const headRow = tableEl.querySelector('thead tr')
        if (headRow && !headRow.querySelector(`.${CELL_CLASS}`)) {
          const th = document.createElement('th')
          th.className = CELL_CLASS
          th.setAttribute('aria-hidden', 'true')
          headRow.appendChild(th)
        }
        tableEl.querySelectorAll('tbody tr').forEach((row) => {
          if (row.querySelector(`:scope > .${CELL_CLASS}`)) return
          row.appendChild(buildCell(row))
        })
      })
    }

    // Rebuild every cell when the inputs change (a new user, new permissions).
    document.querySelectorAll(`.collection-list .table .${CELL_CLASS}`).forEach((el) => el.remove())
    // idempotent, so the observer settles right after each decoration pass
    const observer = new MutationObserver(decorate)
    observer.observe(document.body, { childList: true, subtree: true })
    decorate()
    return () => observer.disconnect()
  }, [config, permissions, router, t])

  return (
    <>
      {children}
      {dialogDelete.modal}
    </>
  )
}
