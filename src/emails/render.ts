import type { ReactElement } from 'react'
import { render } from 'react-email'

/** An email as HTML and as plain text; the text part helps with spam filters. */
export const renderEmail = async (email: ReactElement) => ({
  html: await render(email),
  text: await render(email, { plainText: true }),
})
