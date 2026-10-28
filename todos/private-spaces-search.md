# Private Spaces search

- [x] Inspect access, source shapes, installed APIs and approved research.
- [x] Blocking first steps. Use existing permission semantics and disposable services.
- [x] Independent workstreams. Access, index lifecycle, endpoint and UI belong to one owner in this subtask.
- [x] Shared mutable state. Serialize private index writes and rebuilds with a Postgres advisory lock.
- [x] Smallest safe decomposition. One implementation owner; nested delegation forbidden by task.
- [x] Implement typed projection, live validation and bounded cursor search.
- [x] Implement transactional outbox, retries and explicit rebuild.
- [x] Integrate private/public UI and session cleanup.
- [x] Verify real engines, access transitions, failures, lint and types.
- [x] Document rollout and measured limits.
- [x] Initial feature handoff. Commits and PR were owned by the parent in that phase.

## Production preparation

- [x] Inspect live Application, Compose, volumes, engine versions and public credentials.
- [x] Package and relocate the maintenance CLI; verify real disposable Postgres access.
- [x] Add key-audit release gate, endpoint separation and queue status checks.
- [x] Provision private Typesense 30.2, persistent volume and dedicated internal overlay.
- [x] Bootstrap restricted private keys without exposing secret values.
- [x] Save disabled worker, health and generation-retention schedules.
- [x] Verify corrected main browser build and revoke old wildcard key.
- [x] Run final focused/disposable/type/lint checks and publish PR update.
- [ ] Authorized merge/deploy, migration, rebuild, on-host acceptance and feature activation.
- [ ] Establish private off-host Postgres backup and restore policy.
- [ ] Resolve exhaustive counts/A-Z beyond the bounded scan if required for release.
