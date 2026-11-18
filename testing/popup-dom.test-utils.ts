/**
 * The parts of the DOM that ui-sdk's popups need and jsdom lacks (the ui-sdk
 * testing guide's stubs). Call it before anything opens.
 */
export const stubPopupDom = () => {
  CSS.supports ??= () => false
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  HTMLElement.prototype.showPopover = function () {}
  HTMLElement.prototype.hidePopover = function () {}
  Element.prototype.getAnimations = () => []
  // A sheet holds its backdrop's dim in a paused animation.
  Element.prototype.animate = () =>
    ({
      currentTime: 0,
      finished: Promise.resolve(),
      pause() {},
      play() {},
      cancel() {},
      finish() {},
    }) as unknown as Animation
  Element.prototype.scrollIntoView = function () {}
  Element.prototype.checkVisibility = () => true
  document.head.append(
    Object.assign(document.createElement('style'), {
      textContent: '[popover] { display: block !important }',
    }),
  )
}

export const stubMatchMedia = () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
