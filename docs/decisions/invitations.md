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
