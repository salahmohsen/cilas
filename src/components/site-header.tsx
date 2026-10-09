'use client'

import { SiteHeader } from '@/components/arc/blocks/site-header/site-header'
import Image from 'next/image'
import { BookOpen, Users, Building, TreePine, Newspaper, Calendar, Award } from 'lucide-react'

const studyLinks = [
  {
    label: 'Thematic Courses',
    href: '/study/thematic',
    description:
      'Spring 12-week courses emerging from three fields of study. Open to visiting students (8 places per course). Hosted on rooftop and online.',
  },
  {
    label: 'Labs',
    href: '/study/labs',
    description:
      '10–12 week project-based "playful production". Experiment with translation, space, media, and pedagogy. Emphasise experiential learning, welcome all walks of life.',
  },
  {
    label: 'Workshops',
    href: '/study/workshops',
    description:
      'Short skill/experiment offerings with varied schedules. Focused, hands-on sessions for specific craft or inquiry.',
  },
]

const peopleLinks = [
  {
    label: 'Fellows',
    href: '/people/fellows',
    description:
      'Teachers who "know how to be a student" — not ones who know answers, but who know how to find out. Graduate-trained, experienced educators attuned to context.',
  },
  {
    label: 'CILASians',
    href: '/people/cilasians',
    description: 'Students, alumni, and community members from all walks of life',
  },
  {
    label: 'Governance',
    href: '/governance',
    description: "Advisors and trustees guiding CILAS's mission.",
  },
]

const navigationItems = [
  {
    value: 'study',
    label: 'Study',
    href: '/study',
    icon: BookOpen,
    links: studyLinks,
    feature: {
      title: 'Bridge Programme',
      description:
        'One-year flagship liberal arts programme (2 semesters, 15+ hrs/week). Discussion-based, trans-disciplinary coursework across Historical Consciousness, Philosophical & Poetic Inquiry, and Ethnographic Study.',
      href: '/study',
      image: { src: '/assets/images/cilas-classroom.jpg', alt: 'All CILAS courses' },
    },
  },
  {
    value: 'people',
    label: 'People',
    href: '/people',
    icon: Users,
    links: peopleLinks,
  },

  {
    value: 'articles',
    label: 'Articles',
    href: '/articles',
    icon: Newspaper,
    description:
      'Community writing: featured essays, fellow reflections, CILASian voices. Draft → Community → Public workflow. "Food for thought" newsletter archive. Bilingual (AR/EN).',
  },
  {
    value: 'calendar',
    label: 'Calendar',
    href: '/calendar',
    icon: Calendar,
  },
]

export function CILASSiteHeader() {
  return (
    <SiteHeader
      variant="mega"
      brand={{
        name: 'Cairo Institute of\nLiberal Arts and Sciences',
        href: '/',
        mark: <Image src="/assets/images/logo.webp" alt="CILAS" width={25} height={25} />,
      }}
      items={navigationItems}
      secondaryAction={{ label: 'Sign in', href: '/admin' }}
      primaryAction={{ label: 'Apply', href: '/study/bridge/apply' }}
      label="CILAS main navigation"
    />
  )
}
