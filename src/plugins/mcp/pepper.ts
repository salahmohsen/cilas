/**
 * The secret that signs the connections of Claude and ChatGPT
 * (PMOAUTH_TOKEN_PEPPER). A server that is running in production must have it:
 * without it the OAuth plugin cannot start, and every request would fail. A
 * build, a migration and the type generator load the same configuration but
 * never make a token, so they do not need it.
 */
export const MIN_PEPPER_LENGTH = 32

export const assertAssistantSecret = (
  env: Partial<Record<string, string | undefined>> = process.env,
): void => {
  const serving = env.NODE_ENV === 'production' && env.NEXT_PHASE !== 'phase-production-build'
  if (serving && (env.PMOAUTH_TOKEN_PEPPER?.length ?? 0) < MIN_PEPPER_LENGTH) {
    throw new Error(
      `PMOAUTH_TOKEN_PEPPER is required in production: ${MIN_PEPPER_LENGTH} or more characters. Generate one with: openssl rand -hex 32`,
    )
  }
}
