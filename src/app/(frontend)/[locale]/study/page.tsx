import { HoverExpand } from '@/components/unlumen-ui/hover-expand'
import { getPublicPosts } from '@/api/courses.api'
import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'
import config from '@payload-config'
import { getPayload } from 'payload'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'

import { StudyFilters } from '@/components/study-filters'

type Props = { params: Promise<{ locale: string }> }

export default async function CoursesPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('Study')
  const payload = await getPayload({ config })
  const { docs: courses } = await getPublicPosts(payload, locale as 'en' | 'ar')

  const items = courses.map((course) => {
    const cover = course.cover_image

    return {
      label: course.title,
      href: `/${locale}/study/${course.slug}`,
      sublabel: course.subtitle ?? undefined,
      description: course.description
        ? convertLexicalToPlaintext({ data: course.description })
        : undefined,
      image: typeof cover === 'object' ? (cover?.url ?? undefined) : undefined,
      imageAlt: typeof cover === 'object' ? (cover?.alt ?? undefined) : undefined,
    }
  })

  return (
    <div className="flex flex-col gap-8">
      <div className="relative h-96 w-full">
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 px-8 text-center">
          <p className="text-2xl font-bold text-white leading-tight">
            {t('heroQuote')}
          </p>
          <p className="text-white/80 mt-4 text-lg max-w-2xl mx-auto">
            {t('heroAttribution')}
          </p>
        </div>
        <Image
          src="/assets/images/cilas-classroom.jpg"
          alt={t('heroImageAlt')}
          width={1000}
          height={1000}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      </div>
      <StudyFilters />
      <HoverExpand items={items} />
    </div>
  )
}
