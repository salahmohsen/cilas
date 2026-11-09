import type { Form } from '@/payload-types'

/**
 * A form as a page may hand it to the browser. The notification addresses in
 * `emails` are for admins: the form renderer never reads them, but the Local
 * API ignores field access, so a page that passes a whole form to a client
 * component would print them in its HTML.
 */
export const publicForm = <T extends Pick<Form, 'emails'>>(form: T): Omit<T, 'emails'> => {
  const { emails: _emails, ...rest } = form
  return rest
}
