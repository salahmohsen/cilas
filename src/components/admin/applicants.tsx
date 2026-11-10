import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import Link from 'next/link'
import type { AdminViewServerProps, FieldServerComponent } from 'payload'
import { applicantsForFellow } from '@/forms/applicants'

const copy = (ar: boolean) =>
  ar
    ? {
        title: 'المتقدمون',
        all: 'كل المقررات',
        submitted: 'تاريخ التقديم',
        status: 'الحالة',
        shared: 'الإجابات المشتركة',
        accepted: 'مقبول',
        yes: 'نعم',
        no: 'لا',
        amount: 'المساهمة',
        reduction: 'يحتاج إلى تخفيض',
        empty: 'لا توجد طلبات.',
        filter: 'تصفية',
        course: 'المقرر',
      }
    : {
        title: 'Applicants',
        all: 'All courses',
        submitted: 'Submitted',
        status: 'Status',
        shared: 'Shared answers',
        accepted: 'Accepted',
        yes: 'Yes',
        no: 'No',
        amount: 'Contribution',
        reduction: 'Needs a reduction',
        empty: 'No applications.',
        filter: 'Filter',
        course: 'Course',
      }

export async function ApplicantsView({
  initPageResult,
  params,
  searchParams,
  user,
}: AdminViewServerProps) {
  const req = initPageResult.req
  const ar = req.i18n.language === 'ar'
  const t = copy(ar)
  const data = await applicantsForFellow(req.payload, user, ar ? 'ar' : 'en')
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
      <Gutter>
        <h1>{t.title}</h1>
        <form action="/admin/applicants">
          <label>
            {t.course}{' '}
            <select name="course" defaultValue={selected || ''}>
              <option value="">{t.all}</option>
              {data.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.count})
                </option>
              ))}
            </select>
          </label>{' '}
          <button type="submit">{t.filter}</button>
        </form>
        {!applications.length && <p>{t.empty}</p>}
        {applications.map((a) => (
          <article key={a.id} className="cilas-admin-box" style={{ padding: 20, marginTop: 20 }}>
            <h2>{a.name}</h2>
            <p>{a.email}</p>
            <p>
              {t.submitted}: {new Date(a.submitted).toLocaleDateString(ar ? 'ar-EG' : 'en-GB')} ·{' '}
              {t.status}:{' '}
              {ar ? { new: 'جديد', accepted: 'مقبول', rejected: 'مرفوض' }[a.status] : a.status}
            </p>
            <h3>{t.shared}</h3>
            <dl>
              {a.answers.map((answer, i) => (
                <div key={i}>
                  <dt>{answer.label}</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{answer.value}</dd>
                </div>
              ))}
            </dl>
            {a.choices.map((c) => (
              <section key={c.course}>
                <h3>{c.title}</h3>
                <p>
                  {t.accepted}: {c.accepted ? t.yes : t.no}
                </p>
                <dl>
                  {c.answers.map((answer, i) => (
                    <div key={i}>
                      <dt>{answer.label}</dt>
                      <dd style={{ whiteSpace: 'pre-wrap' }}>{answer.value}</dd>
                    </div>
                  ))}
                </dl>
                {'amount' in c && (
                  <>
                    <p>
                      {t.amount}: {c.amount ?? ''} EGP
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
  const result = await applicantsForFellow(req.payload, req.user)
  const course = result.courses.find((c) => c.id === Number(data.id))
  if (!course) return null
  return (
    <Link href={`/admin/applicants?course=${course.id}`}>
      {copy(req.i18n.language === 'ar').title} ({course.count})
    </Link>
  )
}
