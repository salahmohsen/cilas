export type FoldKeyEvent = Pick<
  KeyboardEvent,
  | 'key'
  | 'code'
  | 'shiftKey'
  | 'altKey'
  | 'ctrlKey'
  | 'metaKey'
  | 'repeat'
  | 'isComposing'
  | 'defaultPrevented'
  | 'target'
>

/** Elements that hold the keyboard: inside one, `[` is text or a widget key, not the fold. */
const TYPING = [
  'input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="reset"], [type="image"], [type="file"], [type="color"], [type="range"])',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="textbox"]',
  '[role="searchbox"]',
  '[role="combobox"]',
  '[role="spinbutton"]',
  '[role="listbox"]',
  '[role="grid"]',
  '[role="treegrid"]',
  '[role="tree"]',
  '[role="slider"]',
  '[role="tablist"]',
  'tr[tabindex]',
  '[role="menu"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  'dialog',
].join(', ')

/** An open dialog, sheet, popover panel or menu: the page under it takes no fold key. */
const OVERLAY =
  'dialog[open], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'

/** Whether a dialog or a menu shows anywhere under `root`. */
export const overlayOpen = (root: ParentNode): boolean =>
  [...root.querySelectorAll(OVERLAY)].some((element) => element.checkVisibility())

const typingTarget = (target: EventTarget | null) =>
  target instanceof Element &&
  ((target instanceof HTMLElement && target.isContentEditable) || target.closest(TYPING) !== null)

/**
 * The layout decides which keys give `[` (Option on macOS, AltGr, which
 * Windows reports as Ctrl plus Alt), so Shift and Alt do not block the
 * character. Ctrl alone does: `Ctrl+[` stays with the browser and
 * assistive tools.
 */
const byCharacter = (event: FoldKeyEvent) => event.key === '[' && !(event.ctrlKey && !event.altKey)

/**
 * The physical `[` key on a layout where it types no Latin letter (the
 * Arabic layout gives `ج`). A dead key or a letter (AZERTY `^`, QWERTZ
 * `ü`) is not `[` there.
 */
const byPosition = (event: FoldKeyEvent) =>
  event.code === 'BracketLeft' &&
  !event.shiftKey &&
  !event.altKey &&
  !event.ctrlKey &&
  event.key !== 'Dead' &&
  !/\p{Script=Latin}/u.test(event.key)

/**
 * Whether a key press folds or unfolds the sidebar: `[` from anywhere on
 * a wide page, except while typing, while a dialog or menu is open, on a
 * repeat or IME composition, or when the reader turned the shortcut off
 * (WCAG 2.1.4). `overlayOpen` is a function, called last: a page search that
 * a key which is not `[` never pays for.
 */
export const isFoldKey = (
  event: FoldKeyEvent,
  {
    overlayOpen,
    wide,
    shortcutOn,
  }: { overlayOpen: () => boolean; wide: boolean; shortcutOn: boolean },
): boolean =>
  shortcutOn &&
  wide &&
  !event.metaKey &&
  (byCharacter(event) || byPosition(event)) &&
  !event.repeat &&
  !event.isComposing &&
  !event.defaultPrevented &&
  !typingTarget(event.target) &&
  !overlayOpen()
