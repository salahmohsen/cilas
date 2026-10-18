# The email service owns the newsletter list

Newsletter subscribers live in the email service's audience (Resend Audiences), not in Payload. Payload keeps only an archive of sent issues and a transactional email adapter for review notifications. Subscribing needs no account, and consent, unsubscribes and bounces are the provider's job. A subscriber is therefore not a user or a person.

## Outcome (2026-10-18)

Issues are written in Payload (`newsletters`: an intro and picks of courses,
articles and the Bridge) and sent from the issue with Resend Broadcasts to
the segment in `RESEND_AUDIENCE_ID`. Payload stores the broadcast id and the
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
