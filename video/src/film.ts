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
  /** Seconds cut from the start of the recording. */
  trim: number
  playbackRate: number
}

export const FPS = 30
export const TITLE_SECONDS = 4.5
export const OUTRO_SECONDS = 5
export const TRANSITION_FRAMES = 14

// The film, in order. A shot's length follows from its recording, its trim and its speed.
export const film: Shot[] = [
  {
    clip: 'home',
    chapter: 'Discover',
    caption: 'A bilingual home for open study',
    theme: 'light',
    trim: 1,
    playbackRate: 1.3,
  },
  {
    clip: 'study',
    chapter: 'Discover',
    caption: 'Every course, as a list or a grid, with filters',
    theme: 'light',
    trim: 0.6,
    playbackRate: 1.6,
  },
  {
    clip: 'course',
    chapter: 'Discover',
    caption: 'Each course lists its sessions, readings and dates',
    theme: 'light',
    trim: 0.6,
    playbackRate: 1.6,
  },
  {
    clip: 'calendar',
    chapter: 'Discover',
    caption: 'Course meetings and events in one calendar, in Cairo time',
    theme: 'light',
    trim: 0.6,
    playbackRate: 1.7,
  },
  {
    clip: 'events',
    chapter: 'Discover',
    caption: 'Talks, screenings and workshops',
    theme: 'light',
    trim: 0.8,
    playbackRate: 1.5,
  },
  {
    clip: 'event',
    chapter: 'Discover',
    caption: 'Add an event to your calendar, then register',
    theme: 'light',
    trim: 0.5,
    playbackRate: 1.5,
  },
  {
    clip: 'search',
    chapter: 'Discover',
    caption: 'Search courses, articles and people',
    theme: 'light',
    trim: 0.4,
    playbackRate: 1.3,
  },
  {
    clip: 'apply',
    chapter: 'Apply',
    caption: 'Apply with a form that the team builds in the CMS',
    theme: 'light',
    trim: 0.5,
    playbackRate: 1.8,
  },
  {
    clip: 'login',
    chapter: 'Belong',
    caption: 'Students sign in to reach their spaces',
    theme: 'light',
    trim: 0.5,
    playbackRate: 1.7,
  },
  {
    clip: 'spaces',
    chapter: 'Belong',
    caption: 'Each course gets a private space for its students',
    theme: 'light',
    trim: 0.3,
    playbackRate: 1.1,
  },
  {
    clip: 'space-feed',
    chapter: 'Belong',
    caption: 'Posts, readings and the next session in one place',
    theme: 'light',
    trim: 0.5,
    playbackRate: 1.6,
  },
  {
    clip: 'space-calendar',
    chapter: 'Belong',
    caption: 'Open a session to see its materials',
    theme: 'light',
    trim: 0.5,
    playbackRate: 1.6,
  },
  {
    clip: 'fellow-schedule',
    chapter: 'Teach',
    caption: 'Fellows move a session, then save the schedule',
    theme: 'light',
    trim: 0.5,
    playbackRate: 1.7,
  },
  {
    clip: 'admin-dashboard',
    chapter: 'Run',
    caption: 'The dashboard shows what waits for review',
    theme: 'dark',
    trim: 0.8,
    playbackRate: 1.4,
  },
  {
    clip: 'admin-applicants',
    chapter: 'Run',
    caption: 'Accept each applicant, course by course',
    theme: 'dark',
    trim: 0.6,
    playbackRate: 1.5,
  },
  {
    clip: 'admin-course',
    chapter: 'Run',
    caption: 'Move a session, then announce the change to the course space',
    theme: 'dark',
    trim: 0.8,
    playbackRate: 1.7,
  },
  {
    clip: 'ar-home',
    chapter: 'Arabic',
    caption: 'The full site in Arabic, right to left',
    captionAr: 'الموقع كله بالعربية، من اليمين إلى اليسار',
    theme: 'dark',
    trim: 0.3,
    playbackRate: 1.1,
  },
  {
    clip: 'ar-calendar',
    chapter: 'Arabic',
    caption: 'The calendar too',
    captionAr: 'والتقويم أيضًا',
    theme: 'dark',
    trim: 0.4,
    playbackRate: 1.2,
  },
  {
    clip: 'ar-course',
    chapter: 'Arabic',
    caption: 'And every course page',
    captionAr: 'وكل صفحة مقرر',
    theme: 'dark',
    trim: 0.3,
    playbackRate: 1.1,
  },
]

export const cameraOf = (shot: Shot): CameraKey[] => clips[shot.clip].camera

export const shotFrames = (shot: Shot) =>
  Math.round(((clips[shot.clip].seconds - shot.trim) / shot.playbackRate) * FPS)

export const filmFrames =
  Math.round((TITLE_SECONDS + OUTRO_SECONDS) * FPS) +
  film.reduce((sum, shot) => sum + shotFrames(shot), 0) -
  (film.length + 1) * TRANSITION_FRAMES
