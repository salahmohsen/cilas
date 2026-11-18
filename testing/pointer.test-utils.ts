import type {} from '@vitest/browser-playwright'
import { cdp } from 'vitest/browser'

const frameOffset = () => {
  const frame = window.frameElement?.getBoundingClientRect()
  return {
    x: frame?.left ?? 0,
    y: frame?.top ?? 0,
    scale: frame ? frame.width / window.innerWidth : 1,
  }
}

const send = (type: 'mousePressed' | 'mouseMoved' | 'mouseReleased', x: number, y: number) => {
  const offset = frameOffset()
  return cdp().send('Input.dispatchMouseEvent', {
    type,
    x: x * offset.scale + offset.x,
    y: y * offset.scale + offset.y,
    button: type === 'mouseMoved' ? 'none' : 'left',
    buttons: type === 'mouseReleased' ? 0 : 1,
    clickCount: type === 'mouseMoved' ? 0 : 1,
  })
}

export const centerOf = (element: Element) => {
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

export const mouse = {
  down: (point: { x: number; y: number }) => send('mousePressed', point.x, point.y),
  move: (point: { x: number; y: number }) => send('mouseMoved', point.x, point.y),
  up: (point: { x: number; y: number }) => send('mouseReleased', point.x, point.y),
}

export const visibleCenterOf = (element: Element) => {
  let { left, right, top, bottom } = element.getBoundingClientRect()
  right = Math.min(right, window.innerWidth)
  bottom = Math.min(bottom, window.innerHeight)
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const { overflowY, overflowX } = getComputedStyle(parent)
    if (overflowY === 'visible' && overflowX === 'visible') continue
    const clip = parent.getBoundingClientRect()
    left = Math.max(left, clip.left)
    right = Math.min(right, clip.right)
    top = Math.max(top, clip.top)
    bottom = Math.min(bottom, clip.bottom)
  }
  return { x: (left + right) / 2, y: (Math.max(top, 0) + bottom) / 2 }
}
