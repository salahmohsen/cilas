import { Suspense } from 'react'
import { Button } from '@payloadcms/ui'
import type { AdminViewServerProps, FieldServerComponent, Payload } from 'payload'
import { applicantsFor, applicantViewer, type ApplicantViewer } from '@/forms/applicants'
import messagesEn from '../../../messages/en.json'
import messagesAr from '../../../messages/ar.json'
import { Skeleton } from '@/components/arc/skeleton/skeleton'
import { ApplicantsIntl } from './applicants-intl'
import { ApplicantsGrid, ApplicantsError } from './applicants-grid'
import { applicantsCopy } from './applicants-copy'
import styles from './applicants.module.css'
import { adminLanguage, ArcAdminView } from './arc-admin-view'

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

export async function ApplicantsView(view: AdminViewServerProps) {
  const req = view.initPageResult.req
  const language = adminLanguage(req)
  const ar = language === 'ar'
  const t = applicantsCopy(ar)
  const viewer = applicantViewer(view.user)
  return (
    <ArcAdminView view={view} language={language} title={t.title} allowed={viewer !== null}>
      <Suspense
        fallback={
          <div className={styles.grid} aria-busy="true">
            {[0, 1, 2].map((id) => (
              <Skeleton key={id} lines={5} label={t.loading} />
            ))}
          </div>
        }
      >
        {/* The applications show the public form, which reads its text from next-intl. */}
        <ApplicantsIntl locale={language} messages={(ar ? messagesAr : messagesEn).Forms}>
          <Applications payload={req.payload} viewer={viewer} ar={ar} />
        </ApplicantsIntl>
      </Suspense>
    </ArcAdminView>
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
    <div className="sidebar-action">
      <Button
        buttonStyle="secondary"
        el="link"
        margin={false}
        size="medium"
        to={`/admin/applicants?course=${course.id}`}
      >
        {applicantsCopy(req.i18n.language === 'ar').title} ({totalDocs})
      </Button>
    </div>
  )
}
