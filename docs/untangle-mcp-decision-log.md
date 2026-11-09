# MCP untangle decision log

Question throughout: should these pieces change together?

Redesign (parents), with the initial inventory preserved as child problems:

- Give tools an explicit input-error contract and keep the draft result shape with draft semantics.
  - Hidden: tool.ts chooses structured completeness errors by `_draft` suffix rather than an explicit tool contract.
  - Surplus: succeed merely wraps the identical text result builder.
- Own registration callback-set validation with the assistant allowlist.
  - Hidden: oauth.ts duplicates callback-set ownership checks in HTTP registration and collection validation.
- Own pepper setup and production detection in pepper.ts; keep URL helpers in paths.ts.
  - Hidden: oauth.ts and pepper.ts separately decide when production needs a real secret.
  - Needless: index.ts imports site URL normalization from the volatile OAuth integration.
- Share literal query escaping and reserved question names with their consumers; enforce the authenticated read boundary for form duplicate detection.
  - Hidden: form.ts and lookup.ts separately escape database substring patterns.
  - Hidden: form.ts reads reserved question names separately from form-questions.ts.
  - Security bug: form duplicate detection uses overrideAccess:true without user despite being a user operation.
- Separate course validation from field conversion and persistence; validate create once before slug lookup and update against merged stored state.
  - Hidden: draft-write.ts mixes generic persistence with course-only validation; course creation calls validation twice.
- Keep only current contracts and construct secured resources directly.
  - Needless: resources.ts constructs resources then wraps every handler in a second module-local factory.
  - Surplus: registrationData, RegistrationInput, CreatedDraft, Localized and unused schemas/constants retain the superseded hand-written draft contract.
- Correct the guide against the current capabilities; remove implementation-restating comments while retaining external-package and security explanations.
  - Hidden: ai-access-guide.tsx claims schedules, covers and footnotes cannot be saved, contradicting current tools.
- Special cases: course partial-update merge of schedule/registration/pricing; article body editor and mention conversion; locale row IDs, Arabic/null second pass; source_unmapped exclusion; course slug fallback and bounded collision search; form duplicate override, cycle refusal, choice-label fallback, default thank-you and reserved questions; API-key virtual update aliases; OAuth bearer prefix, callback patterns, signed-out delegation, resource binding, consent and client locks, pinned token-hook layout, retention cleanup and direct adapter deletion; tool pepper placeholder; deleted-account display fallback; malformed OAuth body fallback; Markdown link restrictions, fenced footnotes and reference validation; lookup localization/draft selection and projection; lock release/discard on failure; transaction ownership; test cleanup catches. These need explicit review, not mechanical removal.

Evidence: git history c79a8a00, b0eec7c1, 01682bcf and 58c021aa couples collection contracts, guides and draft tests; OAuth security changes 42f04950 and e9b362cb couple token lifecycle and deletion. No schema changes are needed.

Verification and final fresh-search outcomes will be appended after implementation. Tests are changed last.
