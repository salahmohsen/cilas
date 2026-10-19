# The email service owns the newsletter list

Newsletter subscribers live in the email service's audience (Resend Audiences), not in Payload. Payload keeps only an archive of sent issues and a transactional email adapter for review notifications. Subscribing needs no account, and consent, unsubscribes and bounces are the provider's job. A subscriber is therefore not a user or a person.

## Outcome (2026-10-18)

Issues are written in Payload (`newsletters`: an intro and picks of courses,
articles and the Bridge) and sent from the issue with Resend Broadcasts to
the segment of the issue's Mailing list (2026-10-19: lists replaced the
`RESEND_AUDIENCE_ID` setting; see Mailing lists below). Payload stores the broadcast id and the
send time; the list, consent and unsubscribes stay in Resend. All emails share
one React Email layout whose logo, color, sender, footer and texts are in the
Email settings global.

Admins see the list in Admin → Subscribers (reached from the Newsletters
list), read live from Resend, and export it as CSV in Mailchimp's columns
(subscribed people only, or everyone with a status). Signup uses Resend's
Contacts API with the segment; the Audiences API is deprecated. Broadcasts
do not use the transactional quota (100 a day on the free plan); the free
plan stops broadcasts once the account stores more than 1,000 contacts, so
"Send to subscribers" checks that count first.

## Mailing lists (2026-10-19)

Who an issue goes to is a Mailing list (Admin → Mailing lists), each a Resend
segment, with an optional Resend topic so people can opt out of one kind of
email. One list takes the site's signups; others are synced from CILAS
accounts (every account, roles, courses, programmes, chosen accounts) on save,
on "Sync now" and before each send. A synced list only adds and removes
segment members; it never changes anyone's unsubscribe. The Resend API key
stays a server setting, as it is a secret; segments do not.
