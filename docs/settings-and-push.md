# Settings page and Web Push

One page, `/{locale}/settings`, holds the member's profile and notification
preferences. `/profile` redirects to it.

## Settings page

- `SettingsShell` (`src/components/settings/settings-shell.tsx`): section nav,
  sections, save bar. A section calls `useSettingsSection(id, { count, save,
  discard })` to report its changed fields. Save runs each section with
  changes; Discard drops them all; Cmd or Ctrl+S saves.
- Sections: Profile (`ProfileForm`, embedded) and Notifications
  (`NotificationsSection`).

## Preferences

Stored on the user as `notification_preferences` (JSON), refusals only:
`{ "email": { "approved": false }, "push": { "reaction": false } }`.
Everything is on until turned off. Pure helpers are in
`src/lib/notification-preferences.ts`. Email switches exist only for the kinds
that send email (`EMAIL_KINDS`, review decisions). Review emails check them in
`src/lib/review-mail.ts`; push checks them in `src/lib/push/send.ts`.

## Web Push

- Off unless both `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are set. Then the
  device group is hidden, no worker registers and nothing is sent.
- Generate a pair once: `npx web-push generate-vapid-keys`. Keep it: a new
  pair drops every stored device. `VAPID_SUBJECT` (mailto: or https:) is
  optional and defaults to `mailto:$EMAIL_FROM_ADDRESS`.
- `public/sw.js` handles `push` and `notificationclick`. It has no fetch
  handler and caches nothing. It registers after sign-in
  (`src/components/push/push-registrar.tsx`).
- "Enable on this device" asks for permission from a tap, subscribes, and
  stores the device in `push-subscriptions` (endpoint unique, so a device that
  signs in as someone else moves to them). Sign-out removes this device.
- Sending: `src/lib/realtime/publish.ts` calls `sendPushForNotification` for
  each new notification, without awaiting it. A 404 or 410 from the push
  service deletes the subscription; any other failure is logged. The payload
  carries the kind name, the in-app line and the link, under 4 KB.
- iPhone and iPad: push works only from a Home Screen web app (iOS 16.4 or
  later). The manifest (`src/app/manifest.ts`) already allows the install.
