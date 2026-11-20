import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Profiler, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../foundation.css'
import { BottomSheet } from '../bottom-sheet/bottom-sheet'
import { Dialog, DialogContent } from '../dialog/dialog'
import { Drawer, DrawerContent } from '../drawer/drawer'
import {
  ToastLayer,
  ToastStack,
  ToastStackProvider,
  useToastStack,
  type ToastStackApi,
} from './toast-stack'

const locales = [
  { name: 'en', dir: 'ltr', label: 'Notifications', saved: 'Saved', undo: 'Undo' },
  { name: 'ar', dir: 'rtl', label: 'الإشعارات', saved: 'تم الحفظ', undo: 'تراجع' },
] as const
type Copy = (typeof locales)[number]

function Probe({ into }: { into: { current: ToastStackApi | null } }) {
  const api = useToastStack()
  useEffect(() => {
    into.current = api
  })
  return null
}

function NativeModal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog ref={ref} aria-label="Surface" style={{ width: 320, height: 240 }} onClose={onClose}>
      {children}
      <ToastLayer />
    </dialog>
  )
}

const surfaces = [
  {
    name: 'Dialog',
    scrolls: true,
    view: (open: boolean, close: () => void, body: ReactNode, tall: boolean) => (
      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent title="Surface" description="Details">
          {body}
        </DialogContent>
      </Dialog>
    ),
  },
  {
    name: 'Drawer',
    scrolls: true,
    view: (open: boolean, close: () => void, body: ReactNode, tall: boolean) => (
      <Drawer open={open} onOpenChange={(next) => !next && close()}>
        <DrawerContent title="Surface" description="Details">
          {body}
        </DrawerContent>
      </Drawer>
    ),
  },
  {
    name: 'BottomSheet',
    scrolls: true,
    view: (open: boolean, close: () => void, body: ReactNode, tall: boolean) => (
      <BottomSheet
        open={open}
        onOpenChange={(next) => !next && close()}
        title="Surface"
        initialDetent={tall ? 1 : 0}
      >
        {body}
      </BottomSheet>
    ),
  },
  {
    name: 'native dialog',
    scrolls: false,
    view: (open: boolean, close: () => void, body: ReactNode, tall: boolean) =>
      open ? <NativeModal onClose={close}>{body}</NativeModal> : null,
  },
] as const

function Harness({
  copy,
  surface,
  tall = false,
  into,
}: {
  copy: Copy
  surface: (typeof surfaces)[number]
  tall?: boolean
  into: { current: ToastStackApi | null }
}) {
  const [open, setOpen] = useState(false)
  const body = (
    <div style={tall ? { height: 3000 } : undefined}>
      <button type="button">First control</button>
      <button type="button" data-last="">
        Last control
      </button>
    </div>
  )
  return (
    <ToastStackProvider>
      <Probe into={into} />
      <button type="button" onClick={() => setOpen(true)}>
        Open surface
      </button>
      {surface.view(open, () => setOpen(false), body, tall)}
      <ToastStack label={copy.label} />
    </ToastStackProvider>
  )
}

const region = (copy: Copy) => screen.getByRole('region', { name: new RegExp(`^${copy.label}`) })
const regions = () => document.querySelectorAll('section[aria-label]')
const surfaceOf = (surface: (typeof surfaces)[number]) =>
  surface.name === 'native dialog'
    ? screen.getByRole('dialog', { name: 'Surface' })
    : screen.getByRole('dialog')

const mount = (copy: Copy, surface: (typeof surfaces)[number], tall = false) => {
  document.documentElement.dir = copy.dir
  document.documentElement.lang = copy.name
  const into: { current: ToastStackApi | null } = { current: null }
  render(<Harness copy={copy} surface={surface} tall={tall} into={into} />)
  return into
}

const raise = (into: { current: ToastStackApi | null }, copy: Copy, onClick = vi.fn()) => {
  act(() => {
    into.current!.toast({ title: copy.saved, action: { label: copy.undo, onClick } })
  })
  return onClick
}

const open = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Open surface' }))
}

const inside = (rect: DOMRect) =>
  rect.top >= 0 &&
  rect.left >= 0 &&
  rect.bottom <= window.innerHeight &&
  rect.right <= window.innerWidth

afterEach(() => {
  cleanup()
  document.documentElement.dir = ''
  document.documentElement.lang = ''
})

describe('a popover above a modal dialog', () => {
  it('a popover raised above an open modal dialog stays inert', async () => {
    const handler = vi.fn()
    const dialog = document.createElement('dialog')
    dialog.innerHTML = '<button type="button" id="inside">Inside</button>'
    const popover = document.createElement('div')
    popover.setAttribute('popover', 'manual')
    const outside = document.createElement('button')
    outside.type = 'button'
    outside.textContent = 'Outside'
    outside.addEventListener('click', handler)
    popover.append(outside)
    document.body.append(dialog, popover)
    dialog.showModal()
    popover.showPopover()
    const inner = dialog.querySelector('button')!
    inner.focus()
    outside.focus()
    expect(dialog.contains(document.activeElement)).toBe(true)
    const rect = outside.getBoundingClientRect()
    expect(
      document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2),
    ).not.toBe(outside)
    await userEvent.click(outside, { force: true })
    expect(handler).not.toHaveBeenCalled()
    popover.remove()
    dialog.close()
    dialog.remove()
  })
})

describe.each(locales)('toast layer in $name', (copy) => {
  describe.each(surfaces)('$name', (surface) => {
    it(`a toast raised in an open ${surface.name} is above it, in its tree and reachable`, async () => {
      const into = mount(copy, surface)
      await open()
      const dialog = surfaceOf(surface)
      const onClick = raise(into, copy)
      expect(dialog.contains(region(copy))).toBe(true)
      await expect.element(page.getByText(copy.saved)).toBeVisible()
      const undo = within(dialog).getByRole('button', { name: copy.undo })
      await expect
        .poll(() => {
          const rect = undo.getBoundingClientRect()
          return (
            inside(rect) &&
            document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) ===
              undo
          )
        })
        .toBe(true)
      const last = within(dialog).getByRole('button', { name: 'Last control' })
      last.focus()
      await userEvent.tab()
      expect(document.activeElement).toBe(undo)
      await userEvent.click(undo)
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it(`a toast raised during the ${surface.name} open animation is above it and reachable`, async () => {
      const into = mount(copy, surface)
      fireEvent.click(screen.getByRole('button', { name: 'Open surface' }))
      raise(into, copy)
      const dialog = surfaceOf(surface)
      expect(dialog.contains(region(copy))).toBe(true)
      const undo = within(dialog).getByRole('button', { name: copy.undo })
      await expect
        .poll(() => {
          const rect = undo.getBoundingClientRect()
          return (
            inside(rect) &&
            document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) ===
              undo
          )
        })
        .toBe(true)
    })

    it(`a toast already showing moves into the ${surface.name} with one region and its text added once`, async () => {
      const into = mount(copy, surface)
      raise(into, copy)
      await expect.element(page.getByText(copy.saved)).toBeVisible()
      const added: Node[] = []
      const removed: Node[] = []
      const observer = new MutationObserver((records) => {
        records.forEach((record) => {
          record.addedNodes.forEach((node) => added.push(node))
          record.removedNodes.forEach((node) => removed.push(node))
        })
      })
      observer.observe(document.body, { subtree: true, childList: true, characterData: true })
      await open()
      const dialog = surfaceOf(surface)
      await expect.poll(() => dialog.contains(region(copy))).toBe(true)
      await expect.element(page.getByText(copy.saved)).toBeVisible()
      observer.disconnect()
      const layer = region(copy).parentElement!
      const carries = (node: Node) => node.textContent?.includes(copy.saved) ?? false
      expect(added.filter((node) => carries(node) && layer.contains(node))).toHaveLength(1)
      expect(removed.filter((node) => carries(node) && layer.contains(node))).toHaveLength(0)
      expect(regions()).toHaveLength(1)
    })

    it(`the region goes back to the page when the ${surface.name} closes`, async () => {
      const into = mount(copy, surface)
      await open()
      raise(into, copy)
      expect(surfaceOf(surface).contains(region(copy))).toBe(true)
      await userEvent.keyboard('{Escape}')
      await expect
        .poll(() => document.querySelector('section[aria-label]')?.closest('dialog,[role=dialog]'))
        .toBeNull()
      expect(regions()).toHaveLength(1)
      expect(document.body.textContent).toContain(copy.saved)
    })

    if (surface.scrolls)
      it(`a toast stays in view when the ${surface.name} content scrolls`, async () => {
        await page.viewport(390, 844)
        const into = mount(copy, surface, true)
        await open()
        const dialog = surfaceOf(surface)
        raise(into, copy)
        const scroller = [dialog, ...dialog.querySelectorAll<HTMLElement>('*')].find(
          (element) =>
            element.scrollHeight - element.clientHeight > 1000 &&
            /auto|scroll/.test(getComputedStyle(element).overflowY),
        )!
        scroller.scrollTop = scroller.scrollHeight
        const undo = within(dialog).getByRole('button', { name: copy.undo })
        await expect.poll(() => inside(undo.getBoundingClientRect())).toBe(true)
      })
  })
})

describe('toast layer wiring', () => {
  it('unrelated DOM changes do not render the toast stack again', async () => {
    let commits = 0
    render(
      <ToastStackProvider>
        <Profiler id="stack" onRender={() => (commits += 1)}>
          <ToastStack />
        </Profiler>
      </ToastStackProvider>,
    )
    const before = commits
    const crowd = Array.from({ length: 200 }, () => document.createElement('div'))
    crowd.forEach((node) => document.body.append(node))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    crowd.forEach((node) => node.remove())
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(commits).toBe(before)
  })

  it('with no provider, ToastLayer renders nothing and an Arc Dialog opens without an error', async () => {
    const { container } = render(<ToastLayer />)
    expect(container).toBeEmptyDOMElement()
    render(
      <Dialog defaultOpen>
        <DialogContent title="Plain" description="No toasts here">
          <p>Body</p>
        </DialogContent>
      </Dialog>,
    )
    await expect.element(page.getByRole('dialog')).toBeVisible()
  })
})
