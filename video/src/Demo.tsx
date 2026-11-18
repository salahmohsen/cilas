import { springTiming, TransitionSeries } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import { Fragment } from 'react'
import { useVideoConfig } from 'remotion'
import { film, OUTRO_SECONDS, shotFrames, TITLE_SECONDS, TRANSITION_FRAMES } from './film'
import { Shot } from './Shot'
import { Closing, Opening } from './TitleCard'

const cut = (
  <TransitionSeries.Transition
    presentation={fade()}
    timing={springTiming({
      config: { damping: 200 },
      durationInFrames: TRANSITION_FRAMES,
      durationRestThreshold: 0.001,
    })}
  />
)

export const Demo = () => {
  const { fps } = useVideoConfig()
  return (
    <TransitionSeries name="Film">
      <TransitionSeries.Sequence name="Opening" durationInFrames={Math.round(TITLE_SECONDS * fps)}>
        <Opening />
      </TransitionSeries.Sequence>
      {film.map((shot, i) => (
        <Fragment key={i}>
          {cut}
          <TransitionSeries.Sequence name={shot.clip} durationInFrames={shotFrames(shot)}>
            <Shot shot={shot} />
          </TransitionSeries.Sequence>
        </Fragment>
      ))}
      {cut}
      <TransitionSeries.Sequence name="Closing" durationInFrames={Math.round(OUTRO_SECONDS * fps)}>
        <Closing />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  )
}
