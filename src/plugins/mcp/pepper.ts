/**
 * The secret that signs the connections of Claude and ChatGPT
 * (PMOAUTH_TOKEN_PEPPER). A server that is running in production must have it:
 * without it the OAuth plugin cannot start, and every request would fail. A
 * build, a migration and the type generator load the same configuration but
 * never make a token, so they do not need it.
 */
type Environment = Partial<Record<string, string | undefined>>
const isServing = (env: Environment): boolean =>
  env.NODE_ENV === 'production' && env.NEXT_PHASE !== 'phase-production-build'

export const MIN_PEPPER_LENGTH = 32

export const assertAssistantSecret = (
  env: Partial<Record<string, string | undefined>> = process.env,
): void => {
  if (isServing(env) && (env.PMOAUTH_TOKEN_PEPPER?.length ?? 0) < MIN_PEPPER_LENGTH) {
    throw new Error(
      `PMOAUTH_TOKEN_PEPPER is required in production: ${MIN_PEPPER_LENGTH} or more characters. Generate one with: openssl rand -hex 32`,
    )
  }
}

/**
 * The plugin refuses to load without a 32-character pepper unless NODE_ENV is
 * development or test. `next build`, `payload migrate` and `generate:types`
 * also load the config, and none of them ever makes a token (the Docker build
 * stage even runs the migrations). They get a placeholder. The running server
 * (NODE_ENV=production, not building) never does: it needs the real secret,
 * and src/env.ts refuses to start without it.
 */
const PLACEHOLDER_PEPPER = 'placeholder-for-tools-that-make-no-tokens-0000000000'
export const allowToolsWithoutPepper = (): void => {
  if (process.env.PMOAUTH_TOKEN_PEPPER) return
  if (!isServing(process.env)) process.env.PMOAUTH_TOKEN_PEPPER = PLACEHOLDER_PEPPER
}
