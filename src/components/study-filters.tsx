'use client'

import { useState } from 'react'
import { FilterToolbar, type FilterChip, type FilterField } from '@/components/arc/filter-toolbar/filter-toolbar'

const mockFields: FilterField[] = [
  {
    id: 'cycle',
    label: 'Cycle',
    options: [
      { value: 'fall-2025', label: 'Fall 2025' },
      { value: 'winter-2025', label: 'Winter 2025' },
      { value: 'spring-2026', label: 'Spring 2026' },
      { value: 'summer-2026', label: 'Summer 2026' },
    ],
  },
  {
    id: 'year',
    label: 'Academic Year',
    options: [
      { value: '2024-2025', label: '2024–2025' },
      { value: '2025-2026', label: '2025–2026' },
      { value: '2026-2027', label: '2026–2027' },
    ],
  },
  {
    id: 'fellow',
    label: 'Fellow',
    options: [
      { value: 'karim-goessinger', label: 'Karim-Yassin Goessinger' },
      { value: 'surti-singh', label: 'Surti Singh' },
      { value: 'teun-dekker', label: 'Teun J. Dekker' },
      { value: 'ikai-jeng', label: 'I-Kai Jeng' },
      { value: 'robin-weiss', label: 'Robin Weiss' },
    ],
  },
  {
    id: 'type',
    label: 'Course Type',
    options: [
      { value: 'bridge', label: 'Bridge Programme' },
      { value: 'core', label: 'Core Curriculum' },
      { value: 'thematic', label: 'Thematic Courses' },
      { value: 'lab', label: 'Labs' },
      { value: 'workshop', label: 'Workshops' },
    ],
  },
]

const mockCourses = [
  {
    id: '1',
    title: 'Historical Consciousness',
    subtitle: 'Core Curriculum · Fall 2025',
    description: 'Develop habits of mind for intellectual pursuit through histories and philosophies of the arts and sciences.',
    image: '/assets/images/course-historical.jpg',
    cycle: 'fall-2025',
    year: '2024-2025',
    fellow: 'karim-goessinger',
    type: 'core',
  },
  {
    id: '2',
    title: 'Philosophical and Poetic Inquiry',
    subtitle: 'Core Curriculum · Fall 2025',
    description: 'Engage with interlocutors across historical periods about meaning, language, and art.',
    image: '/assets/images/course-philosophical.jpg',
    cycle: 'fall-2025',
    year: '2024-2025',
    fellow: 'surti-singh',
    type: 'core',
  },
  {
    id: '3',
    title: 'Ethnographic Study',
    subtitle: 'Core Curriculum · Fall 2025',
    description: 'Introduction to ethnographic methods and ways of knowing through fieldwork and reflection.',
    image: '/assets/images/course-ethnographic.jpg',
    cycle: 'fall-2025',
    year: '2024-2025',
    fellow: 'teun-dekker',
    type: 'core',
  },
  {
    id: '4',
    title: 'Translation as Education',
    subtitle: 'Thematic Course · Spring 2026',
    description: 'Explore translation as a pedagogical practice bridging cultures, languages, and ways of thinking.',
    image: '/assets/images/course-translation.jpg',
    cycle: 'spring-2026',
    year: '2025-2026',
    fellow: 'ikai-jeng',
    type: 'thematic',
  },
  {
    id: '5',
    title: 'Urban Media Lab',
    subtitle: 'Lab · Spring 2026',
    description: 'Project-based experimentation with media, space, and the city. Playful production in Darb el-Labbana.',
    image: '/assets/images/course-urban-lab.jpg',
    cycle: 'spring-2026',
    year: '2025-2026',
    fellow: 'robin-weiss',
    type: 'lab',
  },
  {
    id: '6',
    title: 'Writing the Self',
    subtitle: 'Workshop · Winter 2025',
    description: 'Short intensive workshop on autobiographical writing and narrative craft.',
    image: '/assets/images/course-writing-self.jpg',
    cycle: 'winter-2025',
    year: '2024-2025',
    fellow: 'surti-singh',
    type: 'workshop',
  },
  {
    id: '7',
    title: 'Bridge Programme 2025–2026',
    subtitle: 'Bridge Programme · Full Year',
    description: 'One-year flagship liberal arts programme. Two semesters across three fields of study. 15+ hrs/week.',
    image: '/assets/images/course-bridge.jpg',
    cycle: 'fall-2025',
    year: '2025-2026',
    fellow: 'karim-goessinger',
    type: 'bridge',
  },
]

export function StudyFilters() {
  const [filters, setFilters] = useState<FilterChip[]>([])
  const [courses, setCourses] = useState(mockCourses)

  const handleAddFilter = (chip: FilterChip, field: FilterField) => {
    setFilters((prev) => [...prev.filter((f) => f.id !== chip.id), chip])
  }

  const handleRemoveFilter = (id: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== id))
  }

  const handleClearAll = () => {
    setFilters([])
  }

  return (
    <div className="study-filters space-y-6">
      <FilterToolbar
        filters={filters}
        onRemove={handleRemoveFilter}
        onClearAll={handleClearAll}
        addFilter={{
          fields: mockFields,
          onAdd: handleAddFilter,
          label: 'Add filter',
        }}
        label="Course filters"
      />
    </div>
  )
}