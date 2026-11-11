import { Suspense } from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import Link from 'next/link'
import type { AdminViewServerProps, FieldServerComponent, Payload } from 'payload'
import { applicantsFor, applicantViewer, type ApplicantViewer } from '@/forms/applicants'
import { Skeleton } from '@/components/arc/skeleton/skeleton'
import { ApplicantsGrid, ApplicantsError } from './applicants-grid'
import { applicantsCopy } from './applicants-copy'
import styles from './applicants.module.css'
import './dashboard/arc-scope.css'

async function Applications({
  payload,
  viewer,
  ar,
}: {
  payload: Payload
  viewer: ApplicantViewer | null
  ar: boolean
}) {
  let data
  try {
    data = await applicantsFor(payload, viewer, ar ? 'ar' : 'en')
  } catch (error) {
    payload.logger.error({ err: error, msg: 'Could not load applicants' })
    return <ApplicantsError ar={ar} />
  }
  return <ApplicantsGrid data={data} ar={ar} admin={viewer?.kind === 'admin'} />
}

export async function ApplicantsView({
  initPageResult,
  params,
  searchParams,
  user,
}: AdminViewServerProps) {
  const req = initPageResult.req
  const ar = req.i18n.language === 'ar'
  const t = applicantsCopy(ar)
  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={user}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <div
          className={`arc-scope ${styles.page}`}
          dir={ar ? 'rtl' : 'ltr'}
          lang={ar ? 'ar' : 'en'}
        >
          <h1>{t.title}</h1>
          <Suspense
            fallback={
              <div className={styles.grid} aria-busy="true">
                {[0, 1, 2].map((id) => (
                  <Skeleton key={id} lines={5} label={t.loading} />
                ))}
              </div>
            }
          >
            <Applications payload={req.payload} viewer={applicantViewer(user)} ar={ar} />
          </Suspense>
        </div>
      </Gutter>
    </DefaultTemplate>
  )
}

export const CourseApplicants: FieldServerComponent = async ({ data, req }) => {
  if (!data.id) return null
  const viewer = applicantViewer(req.user)
  if (!viewer) return null
  const course = await req.payload.findByID({
    collection: 'courses',
    id: Number(data.id),
    depth: 0,
    overrideAccess: true,
  })
  if (
    viewer.kind === 'fellow' &&
    !course.fellows?.some((f) => (typeof f === 'number' ? f : f.id) === viewer.person)
  )
    return null
  const { totalDocs } = await req.payload.count({
    collection: 'form-submissions',
    where: { 'choices.course': { equals: course.id } },
    overrideAccess: true,
  })
  return (
    <Link href={`/admin/applicants?course=${course.id}`}>
      {applicantsCopy(req.i18n.language === 'ar').title} ({totalDocs})
    </Link>
  )
}
