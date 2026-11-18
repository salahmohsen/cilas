# Calendar UX audit — 17 November 2026

## Scope and coverage

- Mode: FULL. This is a live review with incomplete coverage. Do not treat it as an accessibility conformance assessment.
- Users and goal: visitors find a meeting; members open a space; editors change sessions without loss of work.
- Surfaces: public calendar in English and Arabic; Minds, Machines and Meaning space calendar; course 404 in admin, Sessions tab.
- Constraints: [owner decisions 1–16](/Users/salah/Developer/cilas/docs/plans/2026-11-15-calendar-redesign.md:35). No redundant hints. Keep Cairo time, Saturday first, 12-hour times, logical CSS, and Arabic RTL.
- Evidence: T3 preview, DOM, computed styles, geometry, keyboard actions, and source. Desktop: 1440×900 CSS px. Phone: 390×844 CSS px. Reflow sample: 320×844. No zoom change. Screenshot pixels can differ from CSS pixels. Geometry comes from the page, not the image.
- Sign-in: a new incognito tab first showed the signed-out calendar. The local fixture account then signed in through `/api/users/login` (HTTP 200). No credential is included here.
- Stop condition: later navigation to `/en/calendar?view=3days&date=2026-11-17` timed out after 15000 ms. A same-origin HEAD request to `/en/calendar` returned HTTP 500. The existing page could still show content. Further browser checks stopped at that error. No server was started, stopped, or repaired. The audit tab was closed.
- No Save, Apply, Publish, Save schedule, completed hold, or delete confirmation was used. One drag changed local draft state only. Done showed the leave question. A later preview navigation replaced that page; no explicit discard choice was recorded. This is a test limitation, not proof about browser Back.
- Concurrent work: HEAD changed from `fb14c8edfab621ff5313d318e28b1f189571a916` to `449ca07902046e53fd8e63b084b4d9846f53b50c`. Other edits continued after that. The footer was present in live checks. Sheet layout and session view files changed during the audit. Results describe the captured state; later changes need another check. This reviewer changed no tracked file, index entry, or live record.
- Read: audit skill, linked evidence/checklist/severity/source/alternatives/visual/report files, domain skill entry files, Payload and ui-sdk entry files, owner decisions and unit rules. This is a review; no implementation or test suite ran.

### Browser evidence matrix

I = Inspected with live DOM or interaction evidence. N = Not inspected. Each view in the table is a separate cell. Inspection does not mean that all input methods or all measurements passed. When size, theme, or selected view did not match, that attempt was excluded. Public URLs use `http://localhost:3001/{locale}/calendar`.

| Authentication | Locale | Theme | CSS viewport | Month | Week / 3 days | Day | Agenda |
| -------------- | ------ | ----- | ------------ | ----- | ------------- | --- | ------ |
| Out            | en     | Light | 1440×900     | I     | I             | I   | I      |
| Out            | en     | Dark  | 1440×900     | N     | N             | N   | N      |
| Out            | ar     | Light | 1440×900     | N     | N             | N   | N      |
| Out            | ar     | Dark  | 1440×900     | N     | N             | N   | N      |
| Out            | en     | Light | 390×844      | N/A   | N             | N   | N      |
| Out            | en     | Dark  | 390×844      | N/A   | N             | N   | N      |
| Out            | ar     | Light | 390×844      | N/A   | N             | N   | N      |
| Out            | ar     | Dark  | 390×844      | N/A   | N             | N   | I      |
| In             | en     | Light | 1440×900     | I     | I             | I   | I      |
| In             | en     | Dark  | 1440×900     | I     | I             | I   | I      |
| In             | ar     | Light | 1440×900     | I     | I             | I   | I      |
| In             | ar     | Dark  | 1440×900     | N     | I             | I   | N      |
| In             | en     | Light | 390×844      | N/A   | N             | I   | I      |
| In             | en     | Dark  | 390×844      | N/A   | I             | N   | I      |
| In             | ar     | Light | 390×844      | N/A   | N             | I   | I      |
| In             | ar     | Dark  | 390×844      | N/A   | I             | I   | N      |

Month on a phone is not an owner-required view. Some runs retained a desktop selection during resize; those do not establish the phone default.

| Surface and state                                                      | Width and zoom | Theme                   | Direction | Input and semantics        | Coverage      | Evidence or reason                                                               |
| ---------------------------------------------------------------------- | -------------- | ----------------------- | --------- | -------------------------- | ------------- | -------------------------------------------------------------------------------- |
| Public signed-out course popover, one link                             | 1440, 100%     | Light                   | en LTR    | Pointer, DOM               | Inspected     | View course only; no Edit                                                        |
| Public signed-in course popover, two links                             | 1440, 100%     | Light                   | en LTR    | Pointer, DOM               | Inspected     | View course and Go to space                                                      |
| Public side panel, Up next and legend present                          | 1440, 100%     | Light                   | en LTR    | Pointer, DOM               | Inspected     | Short Course and Screening filter controls; actual filter change not inspected   |
| Public popover, side panel and filter in other locale/theme/auth cells | 1440 and 390   | Both                    | en/ar     | —                          | Not inspected | Stop condition; do not extend the above samples                                  |
| Space view grid and popover                                            | 1440, 100%     | Dark                    | en LTR    | Pointer, DOM               | Inspected     | Turing session; Edit and Open                                                    |
| Space view grid and popover                                            | 390, 100%      | Dark                    | ar RTL    | Pointer, DOM               | Inspected     | Arabic time and action labels                                                    |
| Space edit, tray, one drag, count, leave question                      | 1440, 100%     | Dark                    | en LTR    | Pointer, DOM               | Inspected     | Session 10 dragged to Tuesday; 1 unsaved change; Done asks Leave without saving? |
| Space split-button day menu                                            | 1440           | Dark                    | en        | —                          | Not inspected | Synthetic click did not open menu; no successful menu observation                |
| Space staged Edit form                                                 | 1440           | Dark                    | en        | Pointer, DOM               | Inspected     | Opens directly; Apply footer; no meeting fields                                  |
| Space ordinary Edit form and meeting group                             | 1440           | Dark                    | en        | DOM, keyboard subset       | Inspected     | Meeting 1 group; date and 12-hour time controls                                  |
| Space ordinary Edit form and phone sheet                               | 390            | Dark                    | en/ar     | DOM, keyboard subset in en | Inspected     | Equal footer buttons; Arabic mirror; English grabber name                        |
| Space material + tile dialog, Escape and focus return                  | 390            | Dark                    | en        | Pointer, keyboard, DOM     | Inspected     | Type, title, note, link; Cancel and Done; Escape returns to Add material         |
| Existing material card and its dialog                                  | Both           | Both                    | en/ar     | —                          | Not inspected | Turing form had no saved material card; no fixture was written                   |
| Activity dialog; invalid and refused form states                       | Both           | Both                    | en/ar     | —                          | Not inspected | No submissions permitted; stop condition                                         |
| Brief hold, footer Tab order                                           | 1440 and 390   | Dark                    | en        | Keyboard, DOM              | Inspected     | Brief Enter/Space does not delete; Tab from hold reaches Cancel                  |
| Space other locale/theme/size combinations                             | Both           | Light; other dark cells | en/ar     | —                          | Not inspected | Only exact cells above establish coverage                                        |
| Admin course list and course 404 Sessions tab                          | 1440 and 390   | Dark                    | en LTR    | Pointer, DOM               | Inspected     | Calendar, Unscheduled, session list, stale helper text                           |
| Admin reflow sample                                                    | 320, 100%      | Dark                    | en LTR    | Geometry                   | Inspected     | Document width 494 CSS px                                                        |
| Admin form, light theme, Arabic, other views                           | Both           | Both                    | en/ar     | —                          | Not inspected | Stop condition; appearance override had not changed active admin theme           |
| Complete keyboard paths: toolbar, grid, popover, full form, footer     | Both           | Both                    | en/ar     | —                          | Not inspected | Only the subset above was tested                                                 |
| 200% text, touch hardware, screen-reader speech, reduced motion        | —              | Both                    | en/ar     | —                          | Not inspected | No such test ran                                                                 |

Key screenshots are saved in [the audit folder](/Users/salah/Backups/cilas/screenshots/step5/audit/):

- [Public Month, en, light, desktop](/Users/salah/Backups/cilas/screenshots/step5/audit/public-en-month-light-1440.png)
- [Drawer, en, dark, desktop](/Users/salah/Backups/cilas/screenshots/step5/audit/drawer-en-dark-1440.png)
- [Sheet, en, dark, phone](/Users/salah/Backups/cilas/screenshots/step5/audit/drawer-en-dark-390.png)
- [Sheet, ar, dark, phone](/Users/salah/Backups/cilas/screenshots/step5/audit/drawer-ar-dark-390.png)
- [Admin Sessions, en, dark, phone](/Users/salah/Backups/cilas/screenshots/step5/audit/admin-en-dark-390.png)

## Executive assessment

### Job 3b implementation coverage (2026-11-17)

F1, F2, F5, F7 and F9 are fixed in the commits named below. The final code passes typecheck, lint, full format and the full local unit suite: 215 files, 1,922 passed tests and one expected failure. F8 is unchanged. No owner decision changed.

Evidence: `~/Backups/cilas/screenshots/step5/job3b/REVIEW.md` and 83 PNG files. The checks cover English and Arabic, light and dark, 1440x900 and 390x844. Newly reached states include a saved material card dialog in all eight combinations, staged Move to in all eight combinations, the existing Unscheduled split-button menu in admin course 292, and recorded Tab paths through toolbar/grid, public popover and drawer. The final pass has ten passing checks and no browser errors. It verifies centered Move to dialogs, the tray menu and absence of the stale paragraph in the actual Sessions tab.

The first pass contains failed capture attempts and a public Arabic popover timeout; those remain recorded and are not counted as passes. The corrected pass waits for edit-mode data. Course 404 has no unscheduled item, so that state uses existing sessions in course 292. No fixture was created. No Save, Save schedule, Publish or completed delete was used. No build, e2e or snapshot compare ran. No e2e spec needed a change.

Two space hydration causes were fixed: changing the responsive switch wrapper tree changed generated IDs (`a7088e7d`); the layout's early drawer could hide unfinished streamed page markup, so the drawer host now belongs to resolved space and post pages (`73d13e49`). No warning suppression was added. All eight corrected direct session-link loads had no space hydration warning. A separate warning in Payload's own session edit fields remains outside this fix.

The owner then requested a fix for the transparent tray menu. **Fixed in 6a66d68f.** The menu portal now receives the calendar's Arc scope through a generic split-button menu class prop. Missing surface, spacing, radius and shadow tokens caused the transparent result. The follow-up passes typecheck, lint, format and the full unit suite: 215 files, 1,922 passed tests and one expected failure. All 24 browser checks pass across en/ar, light/dark, 1440x900 and 390x844: opaque surface, keyboard entry and Escape with focus return. Eight `menu-*.png` captures and `menu-surface.json` show the result; `unscheduled-split-menu-final.png` retains the before state. There are now 91 PNG files. Screen reader speech and touch hardware remain untested. F8 is unchanged.

The active count is **0 Critical, 2 High, 4 Medium, and 0 Low**. The live calendar shows Saturday first, Cairo time, and 12-hour times. Arabic uses RTL. The signed-out popover has one course link. The signed-in popover has the required link pair. One drag updated the unsaved count. The new footer has equal Cancel and Save buttons. Escape closed the material dialog and returned focus to its + tile.

Active findings: **0 Critical, 1 High, 5 Medium, 0 Low**. Four earlier findings have live evidence (F1, F2, F5, F7). Two new findings concern admin overflow and stale admin instructions. F3, F4, and F6 are not accepted as confirmed live findings; their code risks remain below. The server error stopped completion of the matrix. No full WCAG pass is claimed.

## Prioritized findings

| #   | Severity | Issue                                    | Location            | Impact                                                             | Recommendation                                           | Source                       | Evidence                  |
| --- | -------- | ---------------------------------------- | ------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- | ---------------------------- | ------------------------- |
| F1  | High     | Delete needs a timed hold                | Space form          | Brief key activation cannot delete                                 | Owner approved decision 19: Enter opens a confirm dialog | WCAG 2.1.1                   | Observed                  |
| F2  | Medium   | Edit mode has no non-drag move path      | Space calendar edit | Existing meeting move/resize still requires drag for pointer input | Owner approved decision 20: "Move to…" in the block menu | WCAG 2.5.7 risk              | Observed                  |
| F5  | Medium   | Copy feed gives no visible result        | Public feed menu    | Result cannot be checked by sight                                  | Fix within decisions 1–16: visible result and fallback   | Design judgment              | Observed, limited attempt |
| F7  | Medium   | Arabic sheet has an English control name | Arabic phone form   | Sheet control is not fully localized                               | Fix within decisions 1–16: localized names               | Design judgment              | Observed                  |
| F8  | Medium   | Admin page overflows on a phone          | Admin course 404    | Page requires horizontal scrolling                                 | Fix within decisions 1–16: repair host reflow            | WCAG 1.4.10 risk             | Observed                  |
| F9  | Medium   | Admin text describes an immediate save   | Admin Sessions tab  | Text gives the wrong rule for calendar edits                       | Fix within decisions 1–16: remove stale hint             | Decision 11 and no-hint rule | Observed                  |

## Detailed analysis

### F1 — Fixed under owner decision 19

**Fixed in d9110544.** Decision 19 adds untimed confirmation. Pointer and Space holds stay. Unit tests cover Cancel focus, Cancel, Escape, one delete call, refusal, pointer hold and staged removal.

1. **Problem title.** Delete needs a timed key hold.
2. **Severity.** Medium (corrected by the orchestrator from High: the function has a single-pointer path outside edit mode, so this is a risk confined to edit mode and the admin, not a product-wide failure). Frequency: unknown. Impact: a brief keyboard or switch activation cannot delete. Persistence: each such activation.
3. **Exact location.** `http://localhost:3001/en/spaces/course/minds-machines-and-meaning?tab=calendar`, ordinary Edit form, dark, 1440 and 390. [hold-to-confirm.tsx:331](/Users/salah/Developer/cilas/src/components/arc/hold-to-confirm/hold-to-confirm.tsx:331); [session-form.tsx:557](/Users/salah/Developer/cilas/src/components/space/session-form.tsx:557).
4. **Description.** Observed. Focused Hold to delete session. A brief Enter at desktop width and a brief Space at phone width left the form open and did not activate deletion. The form has no untimed delete control. No hold was completed. Source confirms that keydown starts a timed animation and early keyup cancels it.
5. **Why it matters.** People who cannot sustain a key press cannot use this control through brief activation.
6. **Supporting principle.** Requirement: [WCAG 2.1.1 Keyboard, A](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html) excludes required timing for a key press. Timed-only access is confirmed in this form. [Pointer Cancellation, A](https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html) remains a risk; early release alone does not prove safe completion.
7. **Recommended solution.** Keep the owner-required hold in the form body. Add ordinary activation that opens a named confirmation with Cancel and Delete session. Keep staged removal under calendar Save. This needs approval because decisions 14/16 replaced confirmation with hold. Check completion on release or effective reversal separately.
8. **Expected benefit.** Delete stays deliberate and becomes available without a timed key press.
9. **Confidence.** High for the timed activation requirement. Pointer completion, reversal, and actual assistive-input speech remain untested.

### F2 — Owner decision 20 (approved 2026-11-17)

**Fixed in 75e9834d.** Move to is available for editable blocks in edit mode. Its day and 12-hour times stage through the calendar edit state. Tests cover validation, all-day blocks, Arabic and RTL.

1. **Problem title.** Staged Edit has no date or time fields.
2. **Severity.** High. Frequency: unknown. Impact: people who cannot drag have no demonstrated simple pointer path to change an existing meeting time in the combined edit task. Persistence: each move or resize.
3. **Exact location.** `http://localhost:3001/en/spaces/course/minds-machines-and-meaning?tab=calendar`, calendar edit, dark, 1440. [session-form.tsx:397](/Users/salah/Developer/cilas/src/components/space/session-form.tsx:397); [week-spans.tsx:69](/Users/salah/Developer/cilas/src/components/calendar/ui/week-spans.tsx:69).
4. **Description.** Observed. After a drag, opened the saved Turing block. The drawer showed Title, Description, Materials, In class, Cancelled, Delete, Cancel, and Apply. It showed no Meetings group. In ordinary Edit the same session did show Meeting 1 with date and time controls. The move produced one unsaved change.
5. **Why it matters.** A keyboard move alternative does not supply an alternative for someone who can tap but cannot drag.
6. **Supporting principle.** Requirement risk: [WCAG 2.5.7 Dragging Movements, AA](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html). The missing fields are confirmed. A complete search of all block menu actions was not completed, so a product-wide failure is not claimed.
7. **Recommended solution (owner decision 20).** Add "Move to…" to the edit-mode block menu (`calendar.tsx:430`; reachable by one tap on the block's "⋯" button and by the ContextMenu key or Shift+F10, `week-grid.tsx:188`). It opens a dialog with a day picker and 12-hour start and end times; Apply stages the change as a drag does; Save sends it. The grid keeps the meetings (decision 11); the component stays domain-free. Rejected: meeting fields in the staged form, because it moves meeting state into the host form against decision 11.
8. **Expected benefit.** Editors can change exact dates and times with taps alone.
9. **Orchestrator review.** Outside edit mode, the Edit session form shows date and time fields per meeting (`session-form.tsx:397`, `!stage`), so a single-pointer path exists in the space. Not yet checked: whether an admin can change meetings in Payload's own Sessions collection; check before building. The grid announces move and resize (`calendar-labels.ts:87`), so a keyboard move may exist; not tested, and keyboard does not satisfy 2.5.7.
10. **Confidence.** Medium. The staged-form difference is direct evidence. Check every block menu and complete a pointer-only move and resize test before a full failure claim.

### F5 — Fix within decisions 1–16

**Fixed in 5c9dad97.** Copy has a visible result and polite status. A failed or absent Clipboard API shows a selectable read-only URL.

1. **Problem title.** Copy feed has no visible result.
2. **Severity.** Medium. Frequency: unknown. Impact: the person cannot confirm the clipboard result by sight. Persistence: each attempt.
3. **Exact location.** `http://localhost:3001/en/calendar`, signed-in, light, desktop, Add to calendar > Copy feed link. [calendar-tools.tsx:103](/Users/salah/Developer/cilas/src/components/calendar/calendar-tools.tsx:103).
4. **Description.** Observed, limited attempt. Opened the actual menu with a pointer action and selected Copy feed link. No visible result appeared in the inspected state. The result span had `clip-path: inset(50%)` and zero visible area. Clipboard success or failure was not established. Source sends both outcomes only to that span.
5. **Why it matters.** A person cannot know whether the feed address replaced the clipboard value.
6. **Supporting principle.** Design judgment: show transient action feedback where the action was taken. This is not a claim that a live region is missing.
7. **Recommended solution.** Keep the polite region. Add a visible Copied or Copy failed result. On failure, offer a selectable feed URL. Guard absent clipboard API access. Use existing text and error tokens and en/ar messages; add no persistent hint.
8. **Expected benefit.** People can check success and recover from failure.
9. **Confidence.** Medium. No visible result was observed, and source confirms hidden-only feedback. Permission rejection, absent API, and delayed feedback need controlled tests.

### F7 — Fix within decisions 1–16

**Fixed in 5aa67651.** Sheet control names and status messages come from English and Arabic messages. Time list names also use translated labels in 75e9834d.

1. **Problem title.** Arabic sheet controls have English names.
2. **Severity.** Medium. Frequency: observed at the Arabic sheet opening. Impact: Arabic readers must interpret an English control name. Persistence: each opening.
3. **Exact location.** `http://localhost:3001/ar/spaces/course/minds-machines-and-meaning?tab=calendar&open=5310`, ordinary Edit sheet, dark, 390. [bottom-sheet.tsx:642](/Users/salah/Developer/cilas/src/components/arc/bottom-sheet/bottom-sheet.tsx:642).
4. **Description.** Observed. The expanded grabber has accessible name Collapse sheet and `aria-expanded=true`. Close and the form actions have Arabic names. The literal English name remains in source. Actual screen-reader speech was not tested.
5. **Why it matters.** The sheet control does not follow the language of the other controls.
6. **Supporting principle.** Design judgment: use the active interface language for control names. No WCAG language failure is claimed.
7. **Recommended solution.** Add translated expand/collapse name props to the shared BottomSheet. Supply them from the session and schedule form callers. Keep the existing control and focus behavior.
8. **Expected benefit.** Arabic users can identify the sheet action in Arabic.
9. **Confidence.** High for the DOM name. Check both expanded and collapsed states and speech after the change.

### F8 — Fix within decisions 1–16

1. **Problem title.** Admin course page needs horizontal scrolling on a phone.
2. **Severity.** Medium. Frequency: both measured phone widths. Impact: a person must scroll the page horizontally as well as vertically. Persistence: each visit at these widths.
3. **Exact location.** `http://localhost:3001/admin/collections/courses/404`, Sessions tab, dark, 390 and 320. Host boundary: [course-calendar.module.css:3](/Users/salah/Developer/cilas/src/components/admin/course-calendar.module.css:3); calendar host: [course-calendar.tsx:71](/Users/salah/Developer/cilas/src/components/admin/course-calendar.tsx:71). The overflow was outside the calendar root as well; no exact offending host rule was established.
4. **Description.** Observed. `document.documentElement.scrollWidth` was 494 at both 390 and 320 CSS px. Admin metadata included a 583.2 px-wide list. The screenshot shows a clipped Publish control and a wrapped visual-editor control. The calendar itself uses a phone Day layout.
5. **Why it matters.** People must move in two directions to inspect the course and use its controls.
6. **Supporting principle.** Requirement risk: [WCAG 1.4.10 Reflow, AA](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html). A data table can need two-dimensional layout; that exception does not automatically cover the whole page. A complete failure attribution needs the host checked separately.
7. **Recommended solution.** Find the metadata and action-row minimum widths in the Payload host. Wrap ordinary metadata and keep local table scrolling inside its container. Keep the calendar's min-inline-size: 0 boundary. Do not hide page overflow as a substitute for access.
8. **Expected benefit.** The course page can be read and operated without horizontal page scrolling.
9. **Confidence.** High for overflow; Medium for root cause. Recheck dark and light at 320 and 390 after a host fix.
10. **Reviewer note (orchestrator).** The plan's unit 3 row traced this overflow to Payload's own admin parts (`aside.nav.pt-nav`, `pt-nav__backdrop`, `progress-bar`, `doc-controls__meta`), not to the calendar host; units 1 to 7 recorded it as pre-existing. A fix must change Payload admin styles, not the calendar.

### F9 — Fix within decisions 1–16

**Fixed in 3dfb3276.** The join-field paragraph and its generated type comment are removed. No replacement text was added.

1. **Problem title.** Admin helper text gives the wrong save rule for calendar edits.
2. **Severity.** Medium. Frequency: observed in the Sessions tab. Impact: editors can mistake a staged calendar change for a published change. Persistence: each reading of the text.
3. **Exact location.** `http://localhost:3001/admin/collections/courses/404`, Sessions tab below the session list, dark. [Courses.ts:310](/Users/salah/Developer/cilas/src/collections/Courses.ts:310).
4. **Description.** Observed. Text says sessions save on their own and a change is public at once. The calendar above uses the combined staged edit path. The text also explains how to open and create a session, contrary to the no-hint constraint.
5. **Why it matters.** The page gives two different save models without a clear scope for the old instruction.
6. **Supporting principle.** Owner requirement: decision 11 defines one calendar Save transaction. Rules for every unit exclude instructions that repeat the controls. This is a product-contract finding, not a WCAG failure.
7. **Recommended solution.** Remove the stale helper paragraph from the join field. Keep meaningful action labels and error messages. Do not replace it with another instruction paragraph.
8. **Expected benefit.** The Sessions tab no longer gives conflicting save advice.
9. **Confidence.** High. Text was rendered and is present in the collection definition. No save was needed to inspect it.

## Recommended solutions

1. Resolve F1 and F2 with the owner. Keep the required placement and combined save model.
2. Fix F5, F7, F8, and F9 within the existing decisions and components.
3. Repeat the unfinished matrix after port 3001 returns normal responses. Check the final concurrent source state.

## Design alternatives

### Hold-to-delete placement

This choice is separate from F1. Moving the control does not repair timed keyboard access. Actual deletion frequency is unknown. Product-wide consistency is unknown. All ratings below are **design judgment**, not measured scores. Do not add the scores. Complexity: 1 is low effort; 3 is high effort.

**A. Last form-body action, after Cancelled. Current decision 16.**

- Layout: fields, Cancelled, full-width danger hold; then the two-button sticky footer.
- Behavior: hold stages deletion in edit mode; outside edit mode it sends deletion. Early release cancels the hold. Footer Cancel discards the current form. Global Save controls staged deletion. See F1 for the untimed input and release changes that need an owner decision.
- Advantages: keeps record deletion separate from form completion; leaves a compact footer.
- Disadvantages: a long form requires scrolling to Delete.
- Accessibility: normal tab sequence; the hold stayed clear of the footer in the tested positions; check zoom. Add the untimed path from F1.
- Use case: editing is the main task; deletion does not need constant access. Deletion frequency still needs evidence.

**B. Full-width persistent row above Cancel / Save. Needs owner decision 16.**

- Layout: sticky danger row, then the two-button row.
- Behavior: same deletion and save rules as A; Delete remains visible during scrolling.
- Advantages: no scroll to find Delete.
- Disadvantages: more persistent destructive emphasis; a taller footer reduces field space.
- Accessibility: more risk of hiding a focused field at short heights or zoom; same untimed path is required.
- Use case: observed frequent deletion that justifies persistent access.

**C. More menu in the drawer header. Needs owner decision 16.**

- Layout: header More menu; Delete opens a separate confirmation step. Footer keeps Cancel / Save.
- Behavior: menu activation opens the delete step; Escape returns to More. After Cancel, return focus to the invoking control. Staged deletion must still wait for global Save.
- Advantages: removes a rare destructive action from the main form.
- Disadvantages: adds a step and hides the action behind a general label. It needs a new place for the required hold.
- Accessibility: requires menu keys, names, and focus return between overlays; F1 still applies if the second step uses only hold.
- Use case: many secondary record actions that warrant a shared More menu. No such action set is established here.

| Criterion                 | A: form body                             | B: persistent row                   | C: header menu             |
| ------------------------- | ---------------------------------------- | ----------------------------------- | -------------------------- |
| Usability                 | 3: separate task groups                  | 2: three persistent actions compete | 2: extra step              |
| Accessibility             | 2: tested positions clear; zoom untested | 2: larger footer needs testing      | 2: more focus transitions  |
| Discoverability           | 2: requires scroll                       | 3: always visible                   | 1: hidden in More          |
| Efficiency                | 2: scroll for Delete                     | 3: direct access                    | 2: menu plus delete step   |
| Visual clarity            | 3: compact footer                        | 2: larger action area               | 3: compact form and footer |
| Consistency               | Unknown: no product-wide sample          | Unknown                             | Unknown                    |
| Implementation complexity | 1: current structure                     | 2: sticky height changes            | 3: menu and extra overlay  |

All three accessibility scores assume F1 is resolved. As implemented, the timed input risk applies to each option.

Proposal A, structure only; not a rendered mockup:

```text
Form fields
Cancelled
[Hold to delete session]    Scrolls with the fields
-----------------------
[Cancel  X] [Check  Apply]  Sticky, equal widths, DOM order
```

Arabic mirrors inline start and inline end. The DOM order stays the same. The live layout was inspected. This text shows the structure only. No changed design was built in this read-only review.

### Source basis for the placement choice

- [Apple HIG Buttons](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/buttons.json): Button roles. It says, “Don’t assign the primary role to a button that performs a destructive action”. Keep Save primary and Delete separate. This is platform guidance, not a web pixel requirement.
- [Apple HIG Alerts](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/alerts.json): Best practices. It distinguishes common undoable actions from uncommon destructive actions without undo. It places the default at the trailing side and Cancel at the leading side. These principles support a safe, separate deletion path; they do not prescribe a form-body delete row.
- [Apple HIG Sheets](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/sheets.json): Best practices and dismissal controls. Cancel leaves without saving; Done completes the task. This supports the two-action completion row. Sheet guidance about a top toolbar is not a rule for this web drawer's footer.
- [NN/g Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/): advanced or infrequent actions can be deferred. Without evidence that deletion is frequent, it does not justify making Delete persistent. It also does not prove that a More menu is best here.
- [WCAG 2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html) concerns timed keys. [WCAG 2.5.2](https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html) concerns cancellation. [WCAG 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) concerns drag alternatives. [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) requires size or a valid exception. None requires one of these three placements. Selected target measurements are in Accessibility verification.

## Final recommendation

Keep option A: Hold to delete session is the last action in the scrolling form, after Cancelled. Keep the equal-width Cancel / Save or Apply row from decision 16. At desktop width each footer button measured 209.5×44 CSS px; on a phone each measured 172×44. Hold measured 431×44 and 356×44. After scrolling to Hold, it remained above the footer in the tested positions. The phone screenshot also shows both footer actions while the fields scroll. Arabic places Cancel at inline start and Save at inline end.

This supports the current placement. It does not establish that all fields remain visible at zoom or after the concurrent sheet changes. Deletion frequency is unknown. Keep the placement unless direct task evidence shows a need for persistent Delete. Resolve timed activation separately through F1. Do not move Delete into the two-button row.

## Accessibility verification

### Confirmed

- F1: brief key activation does not provide an untimed Delete path in the tested form. No deletion was performed.
- The material + dialog exposes fields and actions. Escape closes it and returns focus to Add material. No claim is made about the full Tab loop.
- Title receives initial form focus. Tab from Hold reaches Cancel. Cancel has a visible 2 px outline in the tested dark state. Tab to the primary submit control was not tested.
- A drag updates a polite status to 1 unsaved change. Done opens Leave without saving?. The discard action and Back/Forward were not tested.
- The sheet uses a dialog role. Arabic expand/collapse naming is confirmed as English (F7).
- In the measured phone form: Close is 32×32; meeting Remove is 42×36; date and time controls are 44 px high; + material/activity tiles are 172×88; footer buttons and Hold are 44 px high. These bounds meet the 24×24 minimum for the sampled controls.
- Grabber is 56×20. Its small height does not alone prove failure: target spacing must be evaluated against adjacent targets.
- Admin phone: navigation icons are 36×27; split primary 142×27; split arrow 32×27. Day + is 18×18. No spacing exception was established for that + target; keep it as Risk.

Computed-color samples below use browser Canvas conversion to sRGB, ancestor background composition, and WCAG relative luminance. Ratios are rounded for display only. The sample does not cover every child label or all course tones.

| Element                         | State                     | Foreground / effective background (sRGB) | Ratio           | Result limited to sample                                                  |
| ------------------------------- | ------------------------- | ---------------------------------------- | --------------- | ------------------------------------------------------------------------- |
| Month screening chip text       | Public en, light, 1440    | 9,9,11 / 255,240,215                     | 17.71:1         | Text contrast sufficient                                                  |
| Month screening chip time       | Same                      | 105,78,33 / 255,240,215                  | 6.89:1          | Text contrast sufficient                                                  |
| Month course chip text          | Same                      | 9,9,11 / 255,227,233                     | 16.50:1         | Text contrast sufficient                                                  |
| Day course block inherited text | Public ar, dark, 390      | 242,242,242 / 69,51,55                   | 10.53:1         | Inherited text sufficient; title child uses its own tone token            |
| Hour label                      | Same                      | 140,140,140 / 25,25,25                   | 5.23:1          | Text contrast sufficient                                                  |
| Chip fill against parent        | Light, screening / course | Computed fills                           | 1.12:1 / 1.21:1 | Not a failure by itself; visible text identifies the control              |
| Block fill against parent       | Dark                      | Computed fill                            | 1.49:1          | Border requirement depends on information conveyed; not a blanket failure |

Text samples are assessed against [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) does not require a contrasting boundary when visible content identifies the control. No arbitrary 3:1 fill rule is applied.

### Risk

- F2: all block-menu alternatives were not checked. No complete drag-alternative compliance claim.
- F5: clipboard outcome and delayed success/failure state need controlled checks.
- F8: page overflow is measured, but the precise host cause and exceptions need a separate check.
- Today circle, legend chip text and borders, active focus-ring contrast, block child title contrast, and light hour labels were not fully measured. Inactive outline values are not evidence about an active focus ring.
- Sticky footer at 200% text and after the concurrent sheet offset change needs another check.
- F3, F4, F6 remain source-supported risks, not confirmed runtime failures; see below.

### Needs testing

Every N cell above; full Tab order through toolbar/grid/popover/form/footer; Enter/Space and grid arrows; Escape and focus return for all overlays; sheet collapse/expand; existing material cards; activity dialog; invalid fields; retained input after refusal; live-region speech; filter operation; exact-time pointer alternative; Back/Forward and draft recovery; copy success/rejection/absent API; admin load rejection; access rejection; all contrast and spacing samples listed as Risk; reflow in public and space at 320; text at 200%; touch hardware; reduced motion; a named screen reader. Save, delete, and publish outcomes were outside the allowed actions.

## Needs owner decision

- **F1, decisions 14/16:** resolved by decision 19 and d9110544. Delete stays at the end of the form body, with untimed confirmation beside the hold path.
- **F2 (approved as decision 20):** "Move to…" in the edit-mode block menu, a dialog with day and 12-hour times; Apply stages, Save sends.
- **F1 (approved as decision 19):** keep the pointer and Space hold; a single Enter press (or an assistive-technology click with no hold) opens a confirm dialog, Cancel focused, then Delete (danger). Test with VoiceOver.
- **Placement B or C, decision 16:** do not adopt without new task evidence.
- Activities as cards still have a pending owner decision in decision 10. This audit does not resolve it.

## Considered but rejected

These earlier candidates are rejected **as confirmed live findings**, not as proven-correct code. Their source risks remain open. They are excluded from active severity counts.

| Candidate                                               | Disposition and evidence                                                                                                                                                                                                                                                       | Required check                                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| F3, High: Back/Forward bypasses leave question          | Inferred from code, not confirmed. [leave-guard.ts:12](/Users/salah/Developer/cilas/src/lib/leave-guard.ts:12) excludes history navigation. Live Done did ask. A preview navigation replaced the draft page, but that is not a browser Back/Forward test.                      | Stage title and move; navigate Back outside the range, Forward, and return. Verify retained draft or explicit discard. |
| F4, Medium: failed access looks like no access          | Inferred from code, not confirmed. [use-public-calendar-access.ts:24](/Users/salah/Developer/cilas/src/components/calendar/use-public-calendar-access.ts:24) maps rejection to null. Live sign-in showed View course and Go to space. No rejected access request was induced.  | Reject only the access request; verify error/Retry without granting links.                                             |
| F6, Medium: admin load rejection has no recovery        | Inferred from code, not confirmed. [course-calendar.tsx:81](/Users/salah/Developer/cilas/src/components/admin/course-calendar.tsx:81) awaits without a local catch. The live normal load completed. The later HTTP 500 is not evidence of this specific rejected-promise path. | Reject the client transport call; verify loading ends and Retry restores the calendar.                                 |
| Restore redundant keyboard help                         | Conflicts with decision 12. Repair control access instead.                                                                                                                                                                                                                     | None; keep excluded.                                                                                                   |
| Missing phone panel                                     | Decision 9 excludes the panel on phones.                                                                                                                                                                                                                                       | Needs owner decision if changed.                                                                                       |
| Put Delete next to Cancel and Save                      | Conflicts with decision 16.                                                                                                                                                                                                                                                    | Keep excluded.                                                                                                         |
| Call all low-contrast fills WCAG failures               | Visible labels can identify the controls; contrast exceptions must be checked.                                                                                                                                                                                                 | Measure the information-bearing text, borders, and states.                                                             |
| Rate the later HTTP 500 as a new calendar design defect | Source and server were changing. Cause was not established.                                                                                                                                                                                                                    | Record as audit stop condition, not a product finding.                                                                 |

## References

Sources were fetched on 17 November 2026. Apple passages came from JSON. No Material claim or platform disagreement is needed.

| Source                                                                                                         | Verified passage and use                                                                      |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [Apple HIG Buttons](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/buttons.json) | Roles and hierarchy; avoid a primary destructive action; separate Delete from form completion |
| [Apple HIG Alerts](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/alerts.json)   | Uncommon irreversible actions; leading Cancel and trailing default action                     |
| [Apple HIG Sheets](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/sheets.json)   | Cancel dismisses without saving; Done completes the scoped task                               |
| [WCAG 2.1.1 Keyboard, A](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)                            | SC and Intent; no specific key timing; F1                                                     |
| [WCAG 2.5.2 Pointer Cancellation, A](https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html)    | SC, up-event, abort and reversal; completion remains untested                                 |
| [WCAG 2.5.7 Dragging Movements, AA](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)       | Intent; simple pointer alternative is distinct from keyboard access; F2                       |
| [WCAG 2.5.8 Target Size, AA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)             | SC; 24×24 CSS px or defined exceptions                                                        |
| [WCAG 4.1.3 Status Messages, AA](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)             | Status must have programmatic semantics without forced focus; speech remains untested         |
| [WCAG 1.4.3 Contrast, AA](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)                   | SC, thresholds, large-text and incidental exceptions                                          |
| [WCAG 1.4.11 Non-text Contrast, AA](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)        | Required visual information; visible-label boundary exception                                 |
| [WCAG 1.4.10 Reflow, AA](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)                              | 320 CSS px and two-dimensional content exception; F8 risk                                     |
| [APG Modal Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)                                     | Keyboard Interaction; focus entry, containment, Escape and return; only a subset was tested   |
| [NN/g Ten Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)                              | Status, control, prevention, recovery; source-risk context                                    |
| [NN/g Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)                        | Deferred secondary actions; placement comparison only                                         |

Local inputs: [audit skill](/Users/salah/.claude/skills/ux-auditor/SKILL.md), [owner plan](/Users/salah/Developer/cilas/docs/plans/2026-11-15-calendar-redesign.md), [ui-sdk skill](/Users/salah/Developer/cilas/.agents/skills/ui-sdk/SKILL.md). Source paths identify the inspected checkout. Concurrent edits can move line numbers.
