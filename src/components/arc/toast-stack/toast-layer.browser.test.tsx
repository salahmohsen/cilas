import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Profiler, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../foundation.css'
import { Lightbox } from '@/components/interior/lightbox'
import spaceStyles from '@/components/space/space.module.css'
import ar from '../../../../messages/ar.json'
import en from '../../../../messages/en.json'
import { BottomSheet } from '../bottom-sheet/bottom-sheet'
import { Dialog, DialogContent } from '../dialog/dialog'
import { Drawer, DrawerContent } from '../drawer/drawer'
import { UserMenu } from '../user-menu/user-menu'
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
    view: (open: boolean, close: () => void, body: ReactNode) => (
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
    view: (open: boolean, close: () => void, body: ReactNode) => (
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
    view: (open: boolean, close: () => void, body: ReactNode) =>
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

describe('toast offset and height', () => {
  const [copy] = locales
  const root = document.documentElement

  afterEach(() => {
    root.style.removeProperty('--toast-stack-offset')
  })

  it('the stack sits above --toast-stack-offset and reports its height', async () => {
    root.style.setProperty('--toast-stack-offset', '100px')
    const into = mount(copy, surfaces[0])
    expect(root.style.getPropertyValue('--toast-stack-height')).toBe('0px')
    raise(into, copy)
    await expect.element(page.getByText(copy.saved)).toBeVisible()
    await expect
      .poll(() => region(copy).getBoundingClientRect().bottom)
      .toBeLessThanOrEqual(window.innerHeight - 100)
    await expect
      .poll(() => parseFloat(root.style.getPropertyValue('--toast-stack-height')))
      .toBeGreaterThan(0)
    act(() => into.current!.dismiss())
    await expect.poll(() => root.style.getPropertyValue('--toast-stack-height')).toBe('0px')
  })

  it('the narrow layout sits above --toast-stack-offset too', async () => {
    await page.viewport(390, 844)
    root.style.setProperty('--toast-stack-offset', '100px')
    const into = mount(copy, surfaces[0])
    raise(into, copy)
    await expect.element(page.getByText(copy.saved)).toBeVisible()
    await expect
      .poll(() => region(copy).getBoundingClientRect().bottom)
      .toBeLessThanOrEqual(window.innerHeight - 100)
  })

  it('inside an open Dialog the stack ignores the offset', async () => {
    const into = mount(copy, surfaces[0])
    await open()
    raise(into, copy)
    await expect.element(page.getByText(copy.saved)).toBeVisible()
    const edges = () => {
      const { bottom, left, right } = region(copy).getBoundingClientRect()
      return { bottom, left, right }
    }
    await expect.poll(() => root.style.getPropertyValue('--toast-stack-height')).toBe('0px')
    const flat = edges()
    root.style.setProperty('--toast-stack-offset', '100px')
    await expect.poll(edges).toEqual(flat)
  })
})

const cards = (copy: Copy) =>
  Array.from(region(copy).querySelectorAll<HTMLElement>(':scope li:not([inert])'))
const overlaps = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
const clear = (control: HTMLElement, copy: Copy) => {
  const rect = control.getBoundingClientRect()
  const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
  return (
    inside(rect) &&
    !!hit &&
    control.contains(hit) &&
    cards(copy).every((card) => !overlaps(card.getBoundingClientRect(), rect))
  )
}
const raiseMany = (into: { current: ToastStackApi | null }, copy: Copy, count: number) =>
  act(() => {
    for (let index = 0; index < count; index += 1)
      into.current!.toast({
        id: `room-${index}`,
        title: `${copy.saved} ${index + 1}`,
        action: { label: copy.undo, onClick: () => {} },
        duration: Infinity,
      })
  })

type Layout = 'sticky' | 'short' | 'end'
const roomSurfaces = [
  { name: 'Dialog', layouts: ['sticky', 'short', 'end'], detent: 0 },
  { name: 'Drawer', layouts: ['sticky', 'end'], detent: 0 },
  { name: 'BottomSheet', layouts: ['sticky'], detent: 0 },
  { name: 'BottomSheet', layouts: ['sticky', 'end'], detent: 1 },
] as const

function RoomBody({ layout }: { layout: Layout }) {
  if (layout === 'short')
    return (
      <>
        <p>Short body.</p>
        <button type="button">Footer action</button>
      </>
    )
  if (layout === 'end')
    return (
      <>
        <div style={{ height: 2000 }}>Long body.</div>
        <button type="button">Footer action</button>
      </>
    )
  return (
    <>
      <div style={{ height: 2000 }}>Long body.</div>
      <div
        style={{
          position: 'sticky',
          insetBlockEnd: 0,
          paddingBlock: 12,
          background: 'var(--surface-raised)',
        }}
      >
        <button type="button">Footer action</button>
      </div>
    </>
  )
}

function RoomHarness({
  surface,
  layout,
  copy,
  into,
}: {
  surface: (typeof roomSurfaces)[number]
  layout: Layout
  copy: Copy
  into: { current: ToastStackApi | null }
}) {
  const body = <RoomBody layout={layout} />
  return (
    <ToastStackProvider>
      <Probe into={into} />
      {surface.name === 'Dialog' ? (
        <Dialog defaultOpen>
          <DialogContent title="Surface" closeLabel="Close surface">
            {body}
          </DialogContent>
        </Dialog>
      ) : surface.name === 'Drawer' ? (
        <Drawer defaultOpen>
          <DrawerContent title="Surface" closeLabel="Close surface">
            {body}
          </DrawerContent>
        </Drawer>
      ) : (
        <BottomSheet
          defaultOpen
          title="Surface"
          closeLabel="Close surface"
          initialDetent={surface.detent}
        >
          {body}
        </BottomSheet>
      )}
      <ToastStack label={copy.label} />
    </ToastStackProvider>
  )
}

const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
  { name: '320', width: 320, height: 640 },
] as const

describe('the modal keeps room for its toasts', () => {
  const cases = viewports.flatMap((viewport) =>
    roomSurfaces.flatMap((surface) =>
      surface.layouts
        .filter((layout) => viewport.name !== '320' || layout === 'sticky')
        .flatMap((layout) =>
          locales
            .filter((copy) => copy.name === 'en' || viewport.name === '390')
            .map((copy) => ({ viewport, surface, layout: layout as Layout, copy })),
        ),
    ),
  )

  describe.each(cases)(
    '$surface.name (detent $surface.detent), $layout, $viewport.name, $copy.name',
    ({ viewport, surface, layout, copy }) => {
      const setup = async () => {
        await page.viewport(viewport.width, viewport.height)
        document.documentElement.dir = copy.dir
        document.documentElement.lang = copy.name
        const into: { current: ToastStackApi | null } = { current: null }
        render(<RoomHarness surface={surface} layout={layout} copy={copy} into={into} />)
        const dialog = await vi.waitFor(() => screen.getByRole('dialog'))
        const footer = within(dialog).getByRole('button', { name: 'Footer action' })
        const close = within(dialog).getByRole('button', { name: 'Close surface' })
        return { into, footer, close }
      }

      it.each([1, 3])('a focused footer control stays clear of %i toasts', async (count) => {
        const { into, footer, close } = await setup()
        footer.focus()
        raiseMany(into, copy, count)
        await expect.element(page.getByText(`${copy.saved} ${count}`)).toBeVisible()
        await expect.poll(() => clear(footer, copy), { timeout: 3000 }).toBe(true)
        if (layout === 'short') expect(clear(close, copy)).toBe(true)
      })

      it('a footer control focused after the toast shows is clear of it', async () => {
        const { into, footer } = await setup()
        raiseMany(into, copy, 1)
        await expect.element(page.getByText(`${copy.saved} 1`)).toBeVisible()
        footer.focus()
        await expect.poll(() => clear(footer, copy), { timeout: 3000 }).toBe(true)
      })
    },
  )
})

describe.each(locales)('Esc on a toast inside a modal in $name', (copy) => {
  const modals = [...surfaces.filter((surface) => surface.name !== 'native dialog')]
  it.each(modals)('Esc on a focused toast closes only the toast in a $name', async (surface) => {
    const into = mount(copy, surface)
    await open()
    const dialog = surfaceOf(surface)
    raise(into, copy)
    const undo = await vi.waitFor(() => within(dialog).getByRole('button', { name: copy.undo }))
    within(dialog).getByRole('button', { name: 'Last control' }).focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(undo)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => document.body.textContent?.includes(copy.saved)).toBe(false)
    expect(dialog.isConnected).toBe(true)
    expect(screen.getByRole('dialog')).toBe(dialog)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => screen.queryByRole('dialog')).toBeNull()
  })

  it.each(modals)('a click on the toast action leaves the $name open', async (surface) => {
    const into = mount(copy, surface)
    await open()
    const dialog = surfaceOf(surface)
    const onClick = raise(into, copy)
    const undo = await vi.waitFor(() => within(dialog).getByRole('button', { name: copy.undo }))
    await expect
      .poll(() => {
        const rect = undo.getBoundingClientRect()
        return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      })
      .toBe(undo)
    await userEvent.click(undo)
    expect(onClick).toHaveBeenCalledTimes(1)
    await expect.poll(() => document.body.textContent?.includes(copy.saved)).toBe(false)
    expect(screen.getByRole('dialog')).toBe(dialog)
  })
})

describe.each(surfaces.filter((surface) => surface.name !== 'native dialog'))(
  'a toast raised while the $name closes',
  (surface) => {
    const [copy] = locales
    it('enters once, on the page', async () => {
      const into = mount(copy, surface)
      await open()
      const dialog = surfaceOf(surface)
      const mountedItems = new Set<Element>()
      const observer = new MutationObserver((records) =>
        records.forEach((record) =>
          record.addedNodes.forEach((node) => {
            if (!(node instanceof Element)) return
            if (node.matches('section[aria-live] li')) mountedItems.add(node)
            node.querySelectorAll('section[aria-live] li').forEach((item) => mountedItems.add(item))
          }),
        ),
      )
      observer.observe(document.body, { subtree: true, childList: true })
      await userEvent.keyboard('{Escape}')
      raise(into, copy)
      await expect.poll(() => dialog.isConnected).toBe(false)
      await expect.element(page.getByText(copy.saved)).toBeVisible()
      observer.disconnect()
      expect(mountedItems.size).toBe(1)
      expect([...mountedItems].every((item) => item.isConnected)).toBe(true)
    })
  },
)

function LightboxHarness({ copy, into }: { copy: Copy; into: { current: ToastStackApi | null } }) {
  const [open, setOpen] = useState(true)
  return (
    <NextIntlClientProvider locale={copy.name} messages={copy.name === 'ar' ? ar : en}>
      <ToastStackProvider>
        <Probe into={into} />
        <Lightbox open={open} onClose={() => setOpen(false)} src="/missing.jpg" alt="Photo" />
        <ToastStack label={copy.label} />
      </ToastStackProvider>
    </NextIntlClientProvider>
  )
}

describe.each(locales)('toast layer in the article lightbox in $name', (copy) => {
  const setup = async () => {
    document.documentElement.dir = copy.dir
    document.documentElement.lang = copy.name
    const into: { current: ToastStackApi | null } = { current: null }
    render(<LightboxHarness copy={copy} into={into} />)
    const dialog = await vi.waitFor(() => screen.getByRole('dialog'))
    return { into, dialog }
  }

  it('a toast is above the lightbox, in its tree and its action works', async () => {
    const { into, dialog } = await setup()
    const onClick = raise(into, copy)
    expect(dialog.contains(region(copy))).toBe(true)
    const undo = await vi.waitFor(() => within(dialog).getByRole('button', { name: copy.undo }))
    await expect
      .poll(() => {
        const rect = undo.getBoundingClientRect()
        return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      })
      .toBe(undo)
    await userEvent.click(undo)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog')).toBe(dialog)
  })

  it('Esc on a focused toast closes only the toast', async () => {
    const { into, dialog } = await setup()
    raise(into, copy)
    const undo = await vi.waitFor(() => within(dialog).getByRole('button', { name: copy.undo }))
    undo.focus()
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => document.body.textContent?.includes(copy.saved)).toBe(false)
    expect(screen.getByRole('dialog')).toBe(dialog)
  })
})

describe.each(locales)('toast layer in the phone account menu in $name', (copy) => {
  it('a toast shows above the open account sheet and keeps Sign out clear', async () => {
    await page.viewport(390, 844)
    document.documentElement.dir = copy.dir
    document.documentElement.lang = copy.name
    const into: { current: ToastStackApi | null } = { current: null }
    render(
      <ToastStackProvider>
        <Probe into={into} />
        <UserMenu
          user={{ name: 'Rana Haddad', email: 'rana@example.com' }}
          onSignOut={() => {}}
          showTheme
          defaultOpen
        />
        <ToastStack label={copy.label} />
      </ToastStackProvider>,
    )
    const menu = await vi.waitFor(() => screen.getByRole('menu'))
    raiseMany(into, copy, 3)
    const undo = await vi.waitFor(
      () => within(region(copy)).getAllByRole('button', { name: copy.undo })[0]!,
    )
    await expect
      .poll(() => {
        const rect = undo.getBoundingClientRect()
        return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      })
      .toBe(undo)
    const signOut = within(menu).getByRole('menuitem', { name: /sign out/i })
    signOut.focus()
    await expect.poll(() => clear(signOut, copy), { timeout: 3000 }).toBe(true)
  })
})

describe('long toasts', () => {
  const [, copy] = locales
  const longTitle =
    'تم حفظ التعديلات على الجلسة الأولى من الدورة، وسيتلقى جميع المشاركين إشعارًا بالتغيير في الوقت والمكان الجديدين قبل بدء الجلسة بيوم كامل على الأقل حتى يستعدوا'
  const longDescription = longTitle + ' ' + longTitle

  it('a long toast clamps its title and description and keeps a 390 sheet header clear', async () => {
    await page.viewport(390, 844)
    document.documentElement.dir = copy.dir
    document.documentElement.lang = copy.name
    const into: { current: ToastStackApi | null } = { current: null }
    render(<RoomHarness surface={roomSurfaces[2]} layout="sticky" copy={copy} into={into} />)
    const dialog = await vi.waitFor(() => screen.getByRole('dialog'))
    act(() => {
      into.current!.toast({ title: longTitle, description: longDescription, duration: Infinity })
    })
    const title = await vi.waitFor(() => within(region(copy)).getByText(longTitle))
    const description = within(region(copy)).getByText(longDescription)
    const lines = (element: HTMLElement) =>
      Math.round(
        element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight),
      )
    await expect.poll(() => lines(title)).toBeLessThanOrEqual(2)
    expect(lines(description)).toBeLessThanOrEqual(3)
    const close = within(dialog).getByRole('button', { name: 'Close surface' })
    await expect.poll(() => clear(close, copy), { timeout: 3000 }).toBe(true)
  })

  const longAction = 'Restore every change that this session had before you edited it'

  it('a long action label keeps Dismiss on a 390 screen', async () => {
    await page.viewport(390, 844)
    const [en] = locales
    const into = mount(en, surfaces[0])
    act(() => {
      into.current!.toast({ title: en.saved, action: { label: longAction, onClick: () => {} } })
    })
    const dismiss = await vi.waitFor(() =>
      within(region(en)).getByRole('button', { name: 'Dismiss notification' }),
    )
    await expect.poll(() => inside(dismiss.getBoundingClientRect())).toBe(true)
    expect(within(region(en)).getByRole('button', { name: longAction })).toBeTruthy()
  })

  it('a long action label keeps the toast at its width in a 1440 dialog', async () => {
    await page.viewport(1440, 900)
    const [en] = locales
    const into = mount(en, surfaces[0])
    await open()
    act(() => {
      into.current!.toast({ title: en.saved, action: { label: longAction, onClick: () => {} } })
    })
    const dismiss = await vi.waitFor(() =>
      within(region(en)).getByRole('button', { name: 'Dismiss notification' }),
    )
    await expect.poll(() => inside(dismiss.getBoundingClientRect())).toBe(true)
    const card = cards(en)[0]!
    expect(card.getBoundingClientRect().width).toBeLessThanOrEqual(361)
    expect(region(en).scrollWidth).toBeLessThanOrEqual(region(en).clientWidth + 1)
  })
})

describe('the post dialog lays out its body, not the toast layer', () => {
  it.each([
    {
      name: 'photo post',
      className: spaceStyles.postDialogWide,
      body: spaceStyles.postDialogWideBody,
    },
    { name: 'text post', className: spaceStyles.postDialog, body: spaceStyles.postDialogBody },
  ])(
    'the $name body scrolls and the composer stays reachable above a toast',
    async ({ className, body }) => {
      await page.viewport(1440, 900)
      const [copy] = locales
      const into: { current: ToastStackApi | null } = { current: null }
      render(
        <ToastStackProvider>
          <Probe into={into} />
          <Dialog defaultOpen>
            <DialogContent title="Post" bare className={className} bodyClassName={body}>
              <div style={{ height: 3000 }}>Post and comments.</div>
              <button type="button">Send</button>
            </DialogContent>
          </Dialog>
          <ToastStack label={copy.label} />
        </ToastStackProvider>,
      )
      const dialog = await vi.waitFor(() => screen.getByRole('dialog'))
      const send = within(dialog).getByRole('button', { name: 'Send' })
      const layer = region(copy).parentElement!
      expect(getComputedStyle(layer).overflowY).toBe('visible')
      send.focus()
      raiseMany(into, copy, 3)
      await expect.element(page.getByText(`${copy.saved} 3`)).toBeVisible()
      await expect.poll(() => clear(send, copy), { timeout: 3000 }).toBe(true)
    },
  )
})
