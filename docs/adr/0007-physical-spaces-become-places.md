# Physical spaces become places

The sites where CILAS teaches were called spaces (`spaces`, `cycles.space`, `events.space`). The discussion areas for courses, cohorts and the community need a name, and people already say "course space" and "community space" for them. We rename the physical sites to places throughout (collection, fields, tables, glossary) so that space can mean the discussion area.

The rename is done in full, in its own commit with a migration that renames the tables and columns and keeps the data, before any spaces code. A half rename (new label, old slug) would leave the code saying one word and the admin another.

## Considered options

- Keep physical spaces and call the discussion areas groups. No migration, but the glossary word would differ from what members say, and that does not hold.
- Location instead of place. Rejected: `courses.location` already means offline, online or hybrid. Place also matches the existing `getCurrentPlace()` ("where CILAS is now").
