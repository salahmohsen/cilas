export const MIN_PASSWORD = 8

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const isEmail = (value: string) => EMAIL.test(value.trim())

export type PasswordProblem = 'tooShort' | 'mismatch'

export const passwordProblem = (password: string, confirm: string): PasswordProblem | null => {
  if (password.length < MIN_PASSWORD) return 'tooShort'
  return password === confirm ? null : 'mismatch'
}

export type SendResult = 'sent' | 'failed'

/**
 * Asks for the reset email. Payload answers 200 whether or not an account has
 * this address, so the page can say "if an account exists" and leak nothing.
 */
export const requestResetLink = async (email: string, send = fetch): Promise<SendResult> => {
  try {
    const res = await send('/api/users/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    return res.ok ? 'sent' : 'failed'
  } catch {
    return 'failed'
  }
}

/** `invalid` is an expired or used token (Payload answers 403); `failed` is anything else. */
export type ResetResult = 'saved' | 'invalid' | 'failed'

export const saveNewPassword = async (
  token: string,
  password: string,
  send = fetch,
): Promise<ResetResult> => {
  try {
    const res = await send('/api/users/reset-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    if (res.ok) return 'saved'
    return res.status === 403 || res.status === 400 ? 'invalid' : 'failed'
  } catch {
    return 'failed'
  }
}
