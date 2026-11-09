# Admin MCP review, 9 November 2026

Five independent Codex review rounds checked the admin MCP feature. The fifth
round found no remaining actionable issues in the reviewed code. This is a
source-review result, not proof of compatibility with hosted assistant accounts.

The review fixes cover concurrent consent/code/refresh consumption, refresh
history cleanup, disconnects during rotation and from stale admin lists, literal
punctuation in searches, simultaneous form retries, and accurate instructions
for disabling individual client registrations. Token contention returns a
retryable 503 with Retry-After instead of declaring a valid credential invalid.

The MCP SDK and Zod dependency overrides address the advisories introduced by
the MCP plugin. The audit passes the CI moderate-severity threshold; one low
advisory and the repository's existing ignored advisory remain.

## Verification

- 1,187 unit tests pass.
- 84 focused integration tests pass on a migrated disposable copy of the local
  development database. The final OAuth suite has 42 passing tests, including
  a barrier-controlled overlap between refresh and administrative disconnect.
- Typecheck, changed-file lint, formatting, and whitespace checks pass.
- The final production build passes. The HTTP OAuth verification script also
  passes against that build using `next start` and the disposable database.
- Migrations through the MCP OAuth migration apply successfully to the local
  database copy.

## Deployment and operator checks

The running server requires PMOAUTH_TOKEN_PEPPER in its runtime environment.
It is not a Docker build argument. Verify the setting without displaying it.

Before calling the feature production-ready, an administrator must connect from
Claude web and ChatGPT web on the plans they will use, create bilingual drafts,
review the form/course link, and disconnect the assistant. The scripted protocol
check does not establish those vendors' account-specific compatibility.

During secret setup, redacted connector output was mistakenly used as the saved
environment. No deployment ran with that configuration. Recovery uses the
running container's environment and a direct API readback; never write redacted
configuration values back to Dokploy.
