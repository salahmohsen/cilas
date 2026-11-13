/**
 * The drawings the home hero can stand on, chosen in Site settings › Home
 * content. The first is the default. Each has a picture of itself for the
 * admin's picker, under public/.
 */
export const HERO_SCENES = [
  { value: 'felucca', label: 'Felucca at sea', preview: '/assets/admin/hero-scene-felucca.png' },
  { value: 'crowd', label: 'Walking crowd', preview: '/assets/admin/hero-scene-crowd.png' },
] as const

export type HeroScene = (typeof HERO_SCENES)[number]['value']

export const isHeroScene = (value: unknown): value is HeroScene =>
  HERO_SCENES.some((scene) => scene.value === value)
