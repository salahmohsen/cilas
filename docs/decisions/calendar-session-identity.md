# Calendar session identity

## Problems

The public edit view combines feed items and editable items. Their display IDs differ. A session can appear twice. Cancelled feed meetings must stay visible.

## Decision

Carry `sessionId` from each session source. Merge the sources in `mergePublicEditItems`. Remove a feed item only when it has an editable twin and is not cancelled. Keep events and sessions without a twin. Change the feed cache key because stored entries do not contain this field.

## Verification

Unit tests cover twins, other sessions, events, and cancelled meetings. The public edit e2e fixture uses Thursday. Its former Friday date was the last track of the week, so ArrowRight could not move it. The test now waits for edit mode and checks each move before Save.
