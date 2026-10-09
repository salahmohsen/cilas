# People are separate from users

Most people shown on the site (fellows since 2013, CILASians, advisors, translators, speakers) will never log in, and some have died or left. So public profiles live in a `people` collection, and `users` holds only login accounts, each linked to at most one person. Courses, governance, credits and memberships point at people. Ownership checks (a fellow editing their own course) go from the signed-in user to their linked person.

## Considered Options

- **Everyone is a user** (the original model): this forces invented emails and passwords for hundreds of archive people, and mixes auth data with public profiles.
