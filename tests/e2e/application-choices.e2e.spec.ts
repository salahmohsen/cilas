import { test, expect } from '@playwright/test'
import { formScreenshot } from '../helpers/formScreenshot'
import { applicationFixture, removeApplicationFixture } from '../helpers/applicationFixture'

let fixture: Awaited<ReturnType<typeof applicationFixture>>
test.beforeAll(async () => {
  fixture = await applicationFixture()
})
test.afterAll(async () => {
  if (fixture) await removeApplicationFixture(fixture)
})

test('applies to two cycle courses with separate answers and contributions', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  const [writing, film] = fixture.courses
  await page.goto(
    `${process.env.E2E_BASE_URL ?? 'http://localhost:3000'}/en/study/${writing.slug}/apply`,
  )
  await expect(page.getByRole('checkbox', { name: 'Writing', exact: true })).toBeChecked()
  await expect(page.getByRole('textbox', { name: 'Why film?' })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Choice applicant')
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(`choice-${fixture.suffix}@cilas.test`)
  await page.getByRole('textbox', { name: 'Your interests' }).fill('Shared interests')
  await page.getByRole('checkbox', { name: 'Film', exact: true }).check()
  await page.getByRole('textbox', { name: 'Why writing?' }).fill('To write')
  await page.getByRole('textbox', { name: 'Why film?' }).fill('To study film')
  const sliders = page.getByRole('region', { name: 'Writing', exact: true }).getByRole('slider')
  await expect(sliders.first()).toHaveAttribute('aria-valuetext', '350 EGP')
  await sliders.first().press('End')
  await page
    .getByRole('region', { name: 'Writing', exact: true })
    .getByRole('checkbox', { name: 'I need a lower contribution' })
    .check()
  await formScreenshot(page, testInfo.outputPath('application.png'))
  await expect(page.locator('[data-issues-open]')).toHaveCount(0)
  await page.getByRole('button', { name: /submit|send/i }).click()
  await expect(page.getByRole('status').filter({ hasText: /sent/i })).toBeVisible({
    timeout: 40_000,
  })
  const saved = await fixture.payload.find({
    collection: 'form-submissions',
    where: { form: { equals: fixture.form.id } },
    depth: 0,
  })
  expect(saved.docs).toHaveLength(1)
  expect(saved.docs[0].target).toEqual({ relationTo: 'cycles', value: fixture.cycle.id })
  expect(saved.docs[0].choices?.sort((a, b) => Number(a.course) - Number(b.course))).toMatchObject([
    {
      course: writing.id,
      amount: 900,
      need_reduction: true,
      answers: [{ name: 'reason', label: 'Why writing?', value: 'To write' }],
    },
    {
      course: film.id,
      amount: 350,
      need_reduction: false,
      answers: [{ name: 'reason', label: 'Why film?', value: 'To study film' }],
    },
  ])
  expect(saved.docs[0].submissionData).toEqual(
    expect.arrayContaining([
      { field: 'shared', value: 'Shared interests', id: expect.any(String) },
    ]),
  )
})
