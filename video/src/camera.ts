import { Easing, interpolate } from 'remotion'
import type { CameraKey } from './film'

export type View = { z: number; cx: number; cy: number }

const MOVE_SECONDS = 0.9
const ease = Easing.bezier(0.22, 1, 0.36, 1)

/** The point a zoom looks at, kept inside the page so the frame never shows past an edge. */
const view = ({ z, x, y }: CameraKey): View => {
  const half = 0.5 / z
  return { z, cx: Math.min(Math.max(x, half), 1 - half), cy: Math.min(Math.max(y, half), 1 - half) }
}

const mix = (a: View, b: View, p: number): View => ({
  z: interpolate(p, [0, 1], [a.z, b.z]),
  cx: interpolate(p, [0, 1], [a.cx, b.cx]),
  cy: interpolate(p, [0, 1], [a.cy, b.cy]),
})

/** Where the camera is at second `t` of a recording. Each key starts a move from wherever the last one had got to. */
export const cameraAt = (keys: CameraKey[], t: number): View => {
  let current = view(keys[0])
  for (let i = 1; i < keys.length && keys[i].t <= t; i++) {
    const next = keys[i + 1]
    const end = next && next.t < t ? next.t : t
    const p = Math.min((end - keys[i].t) / MOVE_SECONDS, 1)
    current = mix(current, view(keys[i]), ease(p))
  }
  return current
}
