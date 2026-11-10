import { ApplicantsFilter } from './applicants-filter'
import { formatAmount } from '@/lib/pricing'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter, Pill } from '@payloadcms/ui'
import Link from 'next/link'
import type { AdminViewServerProps, FieldServerComponent } from 'payload'
import { applicantsFor, applicantViewer } from '@/forms/applicants'

const statusPill = { new: 'light', accepted: 'success', rejected: 'error' } as const

const copy = (ar: boolean) =>
  ar
    ? {
        title: 'المتقدمون',
        all: 'كل المقررات',
        submitted: 'تاريخ التقديم',
        shared: 'الإجابات المشتركة',
        accepted: 'مقبول',
        yes: 'نعم',
        no: 'لا',
        amount: 'المساهمة',
        reduction: 'يحتاج إلى تخفيض',
        empty: 'لا توجد طلبات.',
        filter: 'تصفية',
        course: 'المقرر',
        statuses: { new: 'جديد', accepted: 'مقبول', rejected: 'مرفوض' },
      }
    : {
        title: 'Applicants',
        all: 'All courses',
        submitted: 'Submitted',
        shared: 'Shared answers',
        accepted: 'Accepted',
        yes: 'Yes',
        no: 'No',
        amount: 'Contribution',
        reduction: 'Needs a reduction',
        empty: 'No applications.',
        filter: 'Filter',
        course: 'Course',
        statuses: { new: 'New', accepted: 'Accepted', rejected: 'Rejected' },
      }

export async function ApplicantsView({
  initPageResult,
  params,
  searchParams,
  user,
}: AdminViewServerProps) {
  const req = initPageResult.req
  const ar = req.i18n.language === 'ar'
  const lang = ar ? 'ar' : 'en'
  const t = copy(ar)
  const viewer = applicantViewer(user)
  const data = await applicantsFor(req.payload, viewer, lang)
  const selected = Number(searchParams?.course) || null
  const applications = selected
    ? data.applications.filter((a) => a.choices.some((c) => c.course === selected))
    : data.applications
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
      <Gutter className="cilas-applicants">
        <h1>{t.title}</h1>
        <ApplicantsFilter
          courses={data.courses}
          selected={selected}
          all={t.all}
          label={t.course}
          submit={t.filter}
        />
        {!applications.length && <p>{t.empty}</p>}
        {applications.map((a) => (
          <article key={a.id} className="cilas-applicant-card">
            <header className="cilas-applicant-card__header">
              <div>
                <h2>{a.name}</h2>
                <p>{a.email}</p>
              </div>
              <Pill pillStyle={statusPill[a.status]}>{t.statuses[a.status]}</Pill>
            </header>
            <p className="cilas-applicant-card__meta">
              {t.submitted}: {new Date(a.submitted).toLocaleDateString(ar ? 'ar-EG' : 'en-GB')}
            </p>
            <h3>{t.shared}</h3>
            <dl>
              {a.answers.map((answer, i) => (
                <div key={i}>
                  <dt>{answer.label}</dt>
                  <dd>{answer.value}</dd>
                </div>
              ))}
            </dl>
            {a.choices.map((c) => (
              <section key={c.course} className="cilas-applicant-choice">
                <h3>{c.title}</h3>
                <p>
                  {t.accepted}: {c.accepted ? t.yes : t.no}
                </p>
                <dl>
                  {c.answers.map((answer, i) => (
                    <div key={i}>
                      <dt>{answer.label}</dt>
                      <dd>{answer.value}</dd>
                    </div>
                  ))}
                </dl>
                {viewer?.kind === 'admin' && (
                  <>
                    <p>
                      {t.amount}: {c.amount == null ? '' : formatAmount(c.amount, lang)}
                    </p>
                    <p>
                      {t.reduction}: {c.need_reduction ? t.yes : t.no}
                    </p>
                  </>
                )}
              </section>
            ))}
          </article>
        ))}
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
      {copy(req.i18n.language === 'ar').title} ({totalDocs})
    </Link>
  )
}
