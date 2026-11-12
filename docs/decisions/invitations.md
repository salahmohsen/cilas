# Invitations

Job: A new account sets its own password from a link in its first email, without "Forgot password?".

## Decisions and the problems they solve

- The link holds Payload's own reset token, made with `payload.forgotPassword({ disableEmail: true, expiration })` (`src/lib/invitation.ts`). It works for `INVITATION_DAYS` (7) days. `users` sets no expiration of its own, so a normal reset keeps Payload's one hour.
  - Problem: New accounts got a random password and an email that told them to use "Forgot password?", a second email before they could sign in.
- One `createAccount` and one `setPasswordLink` for every new account: an acceptance and an admin's invitation.
  - Problem: Account creation lived inside the application decision code, so an admin invite would have copied it.
- The acceptance email for a new account has a "Set your password" button to the link. The new Invitation email is in the email catalog, in English and Arabic, with its preview and test send. `{days}` in their texts comes from `INVITATION_DAYS`.
  - Problem: A number of days written into the text would drift from the token's real life.
- `/<locale>/welcome/<token>` uses the reset form with welcome words (`resetMessages('Welcome')`). An expired link sends the person to "Send a new link".
- Admin → Invite someone (`/admin/invite`, in `ArcAdminView`): email, name, roles and the email's language. `POST /api/users/invite` makes the account and sends the invitation. A failed email keeps the account and says so.
- Each account's sidebar has "Send a new link" (`POST /api/users/:id/invite`). A new token replaces the older one.
  - Problem: Without it, a person whose link expired, or whose email did not arrive, needed an admin to set a password by hand.
- Users list → select rows → "Invite N people" (`POST /api/users/invite-many`, `inviteMany`). One language per batch. The browser sends the selection in parts of `INVITE_BATCH` (25), about 2 a second, so no request runs long; "select all" across pages reads the ids of the whole query.
  - Problem: At launch many existing users need invitations, and one at a time does not scale.
- It stops when Resend answers 429 and reports who was not tried. The free plan sends 100 transactional emails a day, so a large list goes out over several days.
- `invited_at` ("Invited on", read-only, a list column) is set whenever a set-password link goes out: an invitation or an acceptance for a new account. A batch skips admins and accounts invited within the link's life, unless the admin asks to send again.
  - Problem: Without it, the admin cannot see who still needs an invitation after a daily limit, and could invite the same people twice.
- Bulk invitations stop at `BULK_INVITES_PER_DAY` (80), counted from "Invited on" since midnight UTC, when Resend's day starts.
  - Problem: The free plan's 100 emails a day are for all transactional email. A large batch would use them all, and password resets, decision emails and digests would fail until the next day.
