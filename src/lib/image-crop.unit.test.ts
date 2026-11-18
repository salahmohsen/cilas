import { describe, expect, it } from 'vitest'

import {
  MAX_ZOOM,
  clampOffset,
  clampZoom,
  coverScale,
  cropRect,
  dragAxis,
  fileKind,
  imageIssue,
  megabytes,
  offsetLimit,
  outputSize,
  rubberBand,
  typeNames,
  zoomAt,
} from '@/lib/image-crop'

const landscape = { width: 2000, height: 1000 }
const circle = { width: 184, height: 184 }
const wide = { width: 320, height: 180 }

describe('image crop maths', () => {
  it('covers the frame at zoom 1, on the short side', () => {
    expect(coverScale(landscape, circle)).toBeCloseTo(0.184)
    // a tall photo in a 16:9 frame covers it by width
    expect(coverScale({ width: 1000, height: 2000 }, wide)).toBeCloseTo(0.32)
  })

  it('lets a wide photo move sideways but not up or down at zoom 1', () => {
    const limit = offsetLimit(landscape, circle, 1)
    expect(limit.x).toBeCloseTo(0.25)
    expect(limit.y).toBe(0)
    expect(clampOffset({ x: 0.4, y: 0.2 }, landscape, circle, 1)).toEqual({ x: 0.25, y: 0 })
  })

  it('crops the centre square of a wide photo at rest', () => {
    expect(cropRect(landscape, circle, 1, { x: 0, y: 0 })).toEqual({
      x: 500,
      y: 0,
      width: 1000,
      height: 1000,
    })
  })

  it('crops the left edge when the photo is moved to its limit', () => {
    const rect = cropRect(landscape, circle, 1, { x: 0.25, y: 0 })
    expect(rect.x).toBeCloseTo(0)
    expect(rect.width).toBeCloseTo(1000)
  })

  it('halves the crop at zoom 2 and keeps it inside the photo', () => {
    const rect = cropRect(landscape, circle, 2, clampOffset({ x: 1, y: 1 }, landscape, circle, 2))
    expect(rect.width).toBeCloseTo(500)
    expect(rect.x).toBeCloseTo(0)
    expect(rect.y).toBeCloseTo(0)
  })

  it('keeps the point under the pointer still while zooming', () => {
    const point = { x: 40, y: -30 }
    const next = zoomAt({ x: 0, y: 0 }, landscape, circle, 1, 2, point)
    const before = cropRect(landscape, circle, 1, { x: 0, y: 0 })
    const after = cropRect(landscape, circle, 2, next)
    // the photo pixel under the pointer, from the crop's top left
    const pixel = (rect: typeof before, zoom: number) => {
      const scale = coverScale(landscape, circle) * zoom
      return {
        x: rect.x + (point.x + circle.width / 2) / scale,
        y: rect.y + (point.y + circle.height / 2) / scale,
      }
    }
    // y is clamped at zoom 1 (no room), so only x is free at both zooms
    expect(pixel(after, 2).x).toBeCloseTo(pixel(before, 1).x)
  })

  it('zooms between 1 and the most allowed', () => {
    expect(clampZoom(0.5)).toBe(1)
    expect(clampZoom(9)).toBe(MAX_ZOOM)
  })

  it('lets a drag past the edge follow at a falling rate, never more than the cap', () => {
    expect(rubberBand(0, 46)).toBe(0)
    expect(rubberBand(46, 46)).toBeCloseTo(23)
    expect(rubberBand(10_000, 46)).toBeLessThan(46)
    expect(rubberBand(-46, 46)).toBeCloseTo(-23)
    // inside the limit a drag is one to one
    expect(dragAxis(0.1, 0.25, 368, 46)).toBe(0.1)
    const past = dragAxis(0.5, 0.25, 368, 46)
    expect(past).toBeGreaterThan(0.25)
    expect((past - 0.25) * 368).toBeLessThan(46)
  })

  it('sizes the output on its long side and never enlarges a small crop', () => {
    expect(outputSize(1, 512)).toEqual({ width: 512, height: 512 })
    expect(outputSize(16 / 9, 1600)).toEqual({ width: 1600, height: 900 })
    expect(outputSize(4 / 5, 1600)).toEqual({ width: 1280, height: 1600 })
    expect(outputSize(16 / 9, 1600, { width: 800, height: 450 })).toEqual({
      width: 800,
      height: 450,
    })
  })
})

describe('image checks', () => {
  const accept = ['image/png', 'image/jpeg', 'image/webp']
  const MB = 1024 * 1024

  it('refuses a file of another kind before its size', () => {
    expect(imageIssue({ type: 'application/pdf', size: 20 * MB }, accept, 5 * MB)).toBe('type')
    expect(imageIssue({ type: '', size: 10 }, accept, 5 * MB)).toBe('type')
  })

  it('refuses a photo over the limit and takes one at it', () => {
    expect(imageIssue({ type: 'image/jpeg', size: 5 * MB + 1 }, accept, 5 * MB)).toBe('size')
    expect(imageIssue({ type: 'image/png', size: 5 * MB }, accept, 5 * MB)).toBeNull()
  })

  it('names files as people know them', () => {
    expect(fileKind('notes.pdf')).toBe('PDF')
    expect(fileKind('photo.final.HEIC')).toBe('HEIC')
    expect(fileKind('README')).toBeNull()
    expect(typeNames(accept)).toEqual(['PNG', 'JPG', 'WebP'])
    expect(megabytes(5 * MB)).toBe(5)
    expect(megabytes(12.34 * MB)).toBe(12.3)
  })
})
