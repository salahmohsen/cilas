import { afterEach, describe, expect, it } from 'vitest'

import { isFoldKey, type FoldKeyEvent } from './fold-key'

const ON = { overlayOpen: () => false, wide: true, shortcutOn: true }

const mount = (html: string) => {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  return host.querySelector('[data-target]') ?? host.firstElementChild!
}

const press = (
  target: EventTarget,
  overrides: Partial<FoldKeyEvent> = {},
  context: Partial<typeof ON> = {},
) =>
  isFoldKey(
    {
      key: '[',
      code: 'BracketLeft',
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      repeat: false,
      isComposing: false,
      defaultPrevented: false,
      target,
      ...overrides,
    },
    { ...ON, ...context },
  )

afterEach(() => {
  document.body.replaceChildren()
})

describe('isFoldKey', () => {
  it.each([
    ['a main', '<main tabindex="-1"></main>'],
    ['a link', '<a href="/x">x</a>'],
    ['a button', '<button>x</button>'],
    ['a checkbox', '<input type="checkbox" />'],
    ['a radio', '<input type="radio" />'],
  ])('[ folds from %s', (_name, html) => {
    expect(press(mount(html))).toBe(true)
  })

  it('[ folds from the document', () => {
    expect(press(document)).toBe(true)
  })

  it.each([
    ['Windows AZERTY AltGr+5', { key: '[', code: 'Digit5', altKey: true, ctrlKey: true }],
    ['macOS AZERTY Option+Shift+5', { key: '[', code: 'Digit5', altKey: true, shiftKey: true }],
    ['macOS QWERTZ Option+5', { key: '[', code: 'Digit5', altKey: true }],
    ['the Arabic layout', { key: 'ج', code: 'BracketLeft' }],
  ])('the key folds on %s', (_name, overrides) => {
    expect(press(mount('<main></main>'), overrides)).toBe(true)
  })

  it.each([
    ['Meta', { metaKey: true }],
    ['Ctrl alone', { ctrlKey: true }],
    ['Shift on the position path', { key: 'ج', shiftKey: true }],
    ['Alt on the position path', { key: 'ج', altKey: true }],
    ['Ctrl on the position path', { key: 'ج', ctrlKey: true }],
    ['a dead key (AZERTY)', { key: 'Dead' }],
    ['a Latin letter on that key (QWERTZ)', { key: 'ü' }],
    ['a held key', { repeat: true }],
    ['an IME composition', { isComposing: true }],
    ['a key a widget took', { defaultPrevented: true }],
    ['another key', { key: ']', code: 'BracketRight' }],
    ['a letter', { key: 'b', code: 'KeyB' }],
  ])('the key does nothing with %s', (_name, overrides) => {
    expect(press(mount('<main></main>'), overrides)).toBe(false)
  })

  it.each([
    ['the shortcut is off', { shortcutOn: false }],
    ['the layout is the phone layout', { wide: false }],
    ['a dialog or menu is open', { overlayOpen: () => true }],
  ])('the key does nothing when %s', (_name, context) => {
    expect(press(mount('<main></main>'), {}, context)).toBe(false)
  })

  it.each([
    ['a text input', '<input type="text" />'],
    ['a search input', '<input type="search" />'],
    ['an email input', '<input type="email" />'],
    ['an input with no type', '<input />'],
    ['a textarea', '<textarea></textarea>'],
    ['a select', '<select><option>a</option></select>'],
    ['a contenteditable', '<div contenteditable="true"></div>'],
    ['a child of a contenteditable', '<div contenteditable><span data-target>x</span></div>'],
    [
      'a contenteditable="false" inside a contenteditable',
      '<div contenteditable><span contenteditable="false" data-target>x</span></div>',
    ],
    ['a textbox', '<div role="textbox" tabindex="0"></div>'],
    ['a combobox', '<div role="combobox" tabindex="0"></div>'],
    ['a child of a menu', '<div role="menu"><button data-target>x</button></div>'],
    ['a child of a dialog role', '<div role="dialog"><button data-target>x</button></div>'],
    ['a child of a dialog element', '<dialog open><button data-target>x</button></dialog>'],
    [
      'a listbox option',
      '<div role="listbox"><div role="option" tabindex="0" data-target>x</div></div>',
    ],
    [
      'a grid cell',
      '<div role="grid"><div role="row"><div role="gridcell" tabindex="0" data-target>x</div></div></div>',
    ],
    ['a tree item', '<ul role="tree"><li role="treeitem" tabindex="0" data-target>x</li></ul>'],
    ['a slider', '<div role="slider" tabindex="0"></div>'],
    ['a tab', '<div role="tablist"><button role="tab" data-target>x</button></div>'],
    [
      'a table row that takes focus',
      '<table><tbody><tr tabindex="0" data-target><td>x</td></tr></tbody></table>',
    ],
  ])('the key does nothing from %s', (_name, html) => {
    expect(press(mount(html))).toBe(false)
  })

  it.each([
    ['another key', { key: 'b', code: 'KeyB' }],
    ['a modifier', { key: 'Shift', code: 'ShiftLeft', shiftKey: true }],
    ['Enter', { key: 'Enter', code: 'Enter' }],
  ])('the page is not searched for an open dialog on %s', (_name, overrides) => {
    let looked = 0
    press(mount('<main></main>'), overrides, {
      overlayOpen: () => {
        looked++
        return false
      },
    })
    expect(looked).toBe(0)
  })

  it('the page is searched for an open dialog on the fold key', () => {
    let looked = 0
    press(
      mount('<main></main>'),
      {},
      {
        overlayOpen: () => {
          looked++
          return false
        },
      },
    )
    expect(looked).toBe(1)
  })

  it('a lone contenteditable="false" is not a typing target', () => {
    expect(press(mount('<div contenteditable="false" tabindex="0"></div>'))).toBe(true)
  })
})
