import type { Page } from '@playwright/test'

export interface LoginOptions {
  page: Page
  serverURL?: string
  next?: string
  user: {
    email: string
    password: string
  }
}

export async function login({ page, serverURL = '', user, next = '/admin' }: LoginOptions) {
  await page.goto(`${serverURL}/en/login?next=${encodeURIComponent(next)}`)

  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()

  await page.waitForURL(`${serverURL}${next}`)
}
