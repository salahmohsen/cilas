import sharp from 'sharp'

type Animation = { width: number; height: number; frames: number }

/**
 * An animation of `frames` grey frames of `width` x `height` pixels. Each frame
 * has its own shade, because an encoder merges frames that are the same.
 */
export const animatedImage = (format: 'gif' | 'webp', { width, height, frames }: Animation) => {
  const pixels = Buffer.alloc(width * height * frames)
  for (let frame = 0; frame < frames; frame++)
    pixels.fill((frame * 13 + 7) % 256, frame * width * height, (frame + 1) * width * height)
  return sharp(pixels, { raw: { width, height: height * frames, channels: 1, pageHeight: height } })
    .toFormat(format, { loop: 0, delay: Array<number>(frames).fill(100) })
    .toBuffer()
}
