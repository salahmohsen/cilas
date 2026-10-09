# The schedule pattern is the source of session dates

A course stores its schedule as a pattern (start date, number of weeks, weekly slots in Cairo wall-clock time), not a date on every session. Sessions hold content. A session stores its own dates only when they differ from the pattern, and those dates then replace the computed ones for that session alone. The public calendar expands the pattern when it reads it. This matches how CILAS announces courses ("Tuesdays and Thursdays, 7–9pm, 8 weeks from 3 March") and avoids re-entering dates by hand. Courses whose start is known only to the week stay off the calendar.

## Consequences

- Every date shown anywhere must come from the one shared expansion function, never a separate computation.
- Times are wall-clock Africa/Cairo, so they stay correct across changes to Egypt's daylight-saving rules.
