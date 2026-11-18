import type { Theme } from './brand'
import clips from './clips.json'

export type CameraKey = { t: number; z: number; x: number; y: number }
export type ClipId = keyof typeof clips

export type Shot = {
  clip: ClipId
  chapter: string
  caption: string
  captionAr?: string
  theme: Theme
  /** The part of the recording to show, in seconds: [from, to]. */
  span: [number, number]
  playbackRate: number
  /** Replaces recorded camera keys that frame empty space, by their time. */
  reframe?: Record<number, Omit<CameraKey, 't'>>
}

export const FPS = 30
export const TITLE_SECONDS = 2.5
export const OUTRO_SECONDS = 4
export const TRANSITION_FRAMES = 14

// The film, in order. A shot's length follows from its span and its speed.
export const film: Shot[] = [
  {
    clip: 'home',
    chapter: 'Discover',
    caption: 'A bilingual home for open study',
    theme: 'light',
    span: [0.5, 9.5],
    playbackRate: 1.4,
  },
  {
    clip: 'study',
    chapter: 'Discover',
    caption: 'Every course, as a list or a grid, with filters',
    theme: 'light',
    span: [0.6, 10],
    playbackRate: 1.6,
  },
  {
    clip: 'course',
    chapter: 'Discover',
    caption: 'Each course lists its sessions, readings and dates',
    theme: 'light',
    span: [0.6, 12],
    playbackRate: 1.6,
  },
  {
    clip: 'calendar',
    chapter: 'Discover',
    caption: 'Course meetings and events in one calendar, in Cairo time',
    theme: 'light',
    span: [0.6, 26],
    playbackRate: 1.7,
  },
  {
    clip: 'event',
    chapter: 'Discover',
    caption: 'Talks and screenings, one click from your calendar',
    theme: 'light',
    span: [0.5, 12],
    playbackRate: 1.5,
  },
  {
    clip: 'search',
    chapter: 'Discover',
    caption: 'Search courses, articles and people',
    theme: 'light',
    span: [0.4, 7.5],
    playbackRate: 1.3,
  },
  {
    clip: 'apply',
    chapter: 'Apply',
    caption: 'Apply with a form that the team builds in the CMS',
    theme: 'light',
    span: [0.5, 7],
    playbackRate: 1.5,
  },
  {
    clip: 'login',
    chapter: 'Belong',
    caption: 'Students sign in to reach their spaces',
    theme: 'light',
    span: [4.2, 13.5],
    playbackRate: 1.7,
  },
  {
    clip: 'spaces',
    chapter: 'Belong',
    caption: 'Each course gets a private space for its students',
    theme: 'light',
    span: [0.3, 5.2],
    playbackRate: 1.1,
  },
  {
    clip: 'space-feed',
    chapter: 'Belong',
    caption: 'Posts, readings and the next session in one place',
    theme: 'light',
    span: [0.5, 16.5],
    playbackRate: 1.6,
  },
  {
    clip: 'space-calendar',
    chapter: 'Belong',
    caption: 'Open a session to see its materials',
    theme: 'light',
    span: [7, 17.5],
    playbackRate: 1.5,
  },
  {
    clip: 'fellow-schedule',
    chapter: 'Teach',
    caption: 'Fellows move a session, then save the schedule',
    theme: 'light',
    span: [5.6, 22.5],
    playbackRate: 1.6,
    reframe: {
      16.83: { z: 1.3, x: 0.62, y: 0.6 },
      19.61: { z: 1.3, x: 0.62, y: 0.6 },
    },
  },
  {
    clip: 'admin-dashboard',
    chapter: 'Run',
    caption: 'The dashboard shows what waits for review',
    theme: 'dark',
    span: [0.8, 9.5],
    playbackRate: 1.4,
  },
  {
    clip: 'admin-applicants',
    chapter: 'Run',
    caption: 'Accept each applicant, course by course',
    theme: 'dark',
    span: [0.6, 18],
    playbackRate: 1.6,
  },
  {
    clip: 'admin-course',
    chapter: 'Run',
    caption: 'Move a session, then announce the change to the course space',
    theme: 'dark',
    span: [8.6, 28.4],
    playbackRate: 1.6,
    reframe: { 24.87: { z: 1.3, x: 0.6, y: 0.72 } },
  },
  {
    clip: 'ar-home',
    chapter: 'Arabic',
    caption: 'The full site in Arabic, right to left',
    captionAr: 'الموقع كله بالعربية، من اليمين إلى اليسار',
    theme: 'dark',
    span: [0.3, 5.7],
    playbackRate: 1.1,
  },
  {
    clip: 'ar-calendar',
    chapter: 'Arabic',
    caption: 'The calendar too',
    captionAr: 'والتقويم أيضًا',
    theme: 'dark',
    span: [0.4, 7.7],
    playbackRate: 1.3,
  },
  {
    clip: 'ar-course',
    chapter: 'Arabic',
    caption: 'And every course page',
    captionAr: 'وكل صفحة مقرر',
    theme: 'dark',
    span: [0.3, 6.2],
    playbackRate: 1.2,
  },
]

export const cameraOf = (shot: Shot): CameraKey[] =>
  clips[shot.clip].camera.map((key) => ({ ...key, ...shot.reframe?.[key.t] }))

export const shotFrames = (shot: Shot) =>
  Math.round(
    ((Math.min(shot.span[1], clips[shot.clip].seconds) - shot.span[0]) / shot.playbackRate) * FPS,
  )

export const filmFrames =
  Math.round((TITLE_SECONDS + OUTRO_SECONDS) * FPS) +
  film.reduce((sum, shot) => sum + shotFrames(shot), 0) -
  (film.length + 1) * TRANSITION_FRAMES
