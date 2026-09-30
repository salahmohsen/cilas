# Database migrations

Schema changes are applied through Payload migrations, not dev-mode schema
auto-push. `db.push` is `false` in `src/payload.config.ts`.

## Why not auto-push

`push: true` (Payload's development default) diffs the config against the
database and offers to apply it on stdin. Two problems:

- It asks to `DROP` tables and join tables. Non-interactively — CI, vitest, any
  `getPayload` inside a script — that prompt has nowhere to go, so it either
  hangs or the drop is applied unreviewed.
- It leaves no record of what changed, so there is no way to tell what a
  teammate's database is supposed to look like.

## The baseline

`20260930_040511_initial_baseline` is a **full-schema snapshot**, not a delta.

The development database predates this directory: it was built by dev-mode
auto-push over months of schema edits, and those edits were never recorded. So
the baseline was generated from the config *after* the fact to capture the
schema as it already stood.

**Consequences:**

- Do **not** run `pnpm db:migrate` against that existing database. Every
  `CREATE TABLE` in the baseline's `up` would fail, because the tables are
  already there. The database is already at the baseline state.
- A brand new, empty database **must** run it: `pnpm db:migrate` then creates
  the full schema from scratch.
- Every migration created *after* this one is a normal delta and applies to both
  kinds of database.

## Workflow

```sh
# After editing a collection or field:
pnpm db:migrate:create add_whatever_you_changed

# Review the generated file, then apply:
pnpm db:migrate
```

Always read the generated `up` before applying it. Payload can emit `DROP
TABLE` for a field you thought you had only renamed.
