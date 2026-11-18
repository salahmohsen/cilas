import { Video } from '@remotion/media'
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { fonts, themes } from './brand'
import { cameraAt } from './camera'
import { cameraOf, type Shot as ShotData, shotFrames, TRANSITION_FRAMES } from './film'

// The recordings are a 1600 × 900 page at 2x. The page sits in a window at 90%.
const PAGE = { width: 1600, height: 900 }
const SCALE = 0.9
const WINDOW = { width: PAGE.width * SCALE, height: PAGE.height * SCALE, left: 240, top: 84 }

const rise = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
  easing: Easing.bezier(0.16, 1, 0.3, 1),
} as const

const Page = ({ shot }: { shot: ShotData }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { z, cx, cy } = cameraAt(cameraOf(shot), shot.trim + (frame / fps) * shot.playbackRate)
  return (
    <Video
      src={staticFile(`clips/${shot.clip}.mp4`)}
      trimBefore={Math.round(shot.trim * fps)}
      playbackRate={shot.playbackRate}
      muted
      style={{
        position: 'absolute',
        width: PAGE.width,
        height: PAGE.height,
        scale: z,
        translate: `${(0.5 - cx) * z * PAGE.width}px ${(0.5 - cy) * z * PAGE.height}px`,
      }}
    />
  )
}

const Caption = ({ shot }: { shot: ShotData }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const ink = themes[shot.theme]
  // The caption leaves before the cross-fade, and the next one arrives after it, so two never overlap.
  const leave = shotFrames(shot) - TRANSITION_FRAMES
  return (
    <div
      style={{
        position: 'absolute',
        top: WINDOW.top + WINDOW.height + 30,
        left: 0,
        right: 0,
        textAlign: 'center',
        opacity:
          interpolate(frame, [0.35 * fps, 0.95 * fps], [0, 1], rise) *
          interpolate(frame, [leave - 4, leave + 6], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        translate: interpolate(frame, [0.35 * fps, 0.95 * fps], ['0px 18px', '0px 0px'], rise),
      }}
    >
      <div
        style={{
          fontFamily: fonts.text,
          fontSize: 44,
          fontWeight: 500,
          color: ink.ink,
          letterSpacing: '-0.01em',
        }}
      >
        {shot.caption}
      </div>
      {shot.captionAr && (
        <div
          dir="rtl"
          lang="ar"
          style={{ fontFamily: fonts.text, fontSize: 34, color: ink.muted, marginTop: 6 }}
        >
          {shot.captionAr}
        </div>
      )}
    </div>
  )
}

export const Shot = ({ shot }: { shot: ShotData }) => {
  const ink = themes[shot.theme]
  return (
    <AbsoluteFill style={{ backgroundColor: ink.stage }}>
      <div
        style={{
          position: 'absolute',
          top: 26,
          left: WINDOW.left,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <Img src={ink.mark} style={{ height: 38 }} />
        <span style={{ fontFamily: fonts.title, fontSize: 30, color: ink.ink }}>
          {shot.chapter}
        </span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: WINDOW.left,
          top: WINDOW.top,
          width: WINDOW.width,
          height: WINDOW.height,
          overflow: 'hidden',
          borderRadius: 18,
          backgroundColor: ink.surface,
          outline: `1px solid ${ink.border}`,
          boxShadow:
            shot.theme === 'light'
              ? '0 24px 60px rgba(9, 9, 11, 0.12)'
              : '0 24px 60px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div
          style={{
            width: PAGE.width,
            height: PAGE.height,
            scale: SCALE,
            transformOrigin: '0 0',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Page shot={shot} />
        </div>
      </div>
      <Caption shot={shot} />
    </AbsoluteFill>
  )
}
