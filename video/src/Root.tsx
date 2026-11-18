import { Composition } from 'remotion'
import { Demo } from './Demo'
import { filmFrames, FPS } from './film'

export const RemotionRoot = () => (
  <Composition
    id="CilasDemo"
    component={Demo}
    durationInFrames={filmFrames}
    fps={FPS}
    width={1920}
    height={1080}
  />
)
