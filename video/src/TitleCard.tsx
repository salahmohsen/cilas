import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { fonts, logo, themes } from './brand'

const ink = themes.dark
const settle = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
  easing: Easing.bezier(0.16, 1, 0.3, 1),
} as const

const Line = ({
  at,
  children,
  style,
}: {
  at: number
  children: React.ReactNode
  style: React.CSSProperties
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <div
      style={{
        ...style,
        opacity: interpolate(frame, [at * fps, (at + 0.7) * fps], [0, 1], settle),
        translate: interpolate(
          frame,
          [at * fps, (at + 0.7) * fps],
          ['0px 24px', '0px 0px'],
          settle,
        ),
      }}
    >
      {children}
    </div>
  )
}

const Logo = ({ size }: { size: number }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <Img
      src={logo}
      style={{
        width: size,
        height: size,
        opacity: interpolate(frame, [0, 0.5 * fps], [0, 1], settle),
        scale: interpolate(frame, [0, 1.1 * fps], [0.86, 1], {
          ...settle,
          easing: Easing.spring({ damping: 200 }),
          output: 'perceptual-scale',
        }),
      }}
    />
  )
}

export const Opening = () => (
  <AbsoluteFill
    style={{ backgroundColor: ink.stage, justifyContent: 'center', alignItems: 'center', gap: 56 }}
  >
    <Line at={0.2} style={{ display: 'flex' }}>
      <Img src={ink.wordmark} style={{ width: 1180 }} />
    </Line>
    <Line at={1} style={{ fontFamily: fonts.text, fontSize: 40, color: ink.muted }}>
      A tour of the site: study, calendar, spaces and the CMS
    </Line>
  </AbsoluteFill>
)

export const Closing = () => (
  <AbsoluteFill
    style={{ backgroundColor: ink.stage, justifyContent: 'center', alignItems: 'center', gap: 40 }}
  >
    <Logo size={180} />
    <Line at={0.5} style={{ fontFamily: fonts.title, fontSize: 84, color: ink.ink }}>
      cilas.salahmohsen.com
    </Line>
    <Line
      at={1.1}
      style={{
        fontFamily: fonts.text,
        fontSize: 40,
        color: ink.muted,
        textAlign: 'center',
        lineHeight: 1.5,
      }}
    >
      Cairo Institute of Liberal Arts and Sciences
      <div dir="rtl" lang="ar">
        معهد القاهرة للعلوم والآداب الحرة
      </div>
    </Line>
  </AbsoluteFill>
)
