# Agents

This project uses the Payload CMS skill at `.agents/skills/payload/`.
Start with `.agents/skills/payload/SKILL.md` for a quick reference, then see `.agents/skills/payload/reference/` for detailed docs.

## Code structure (untangle rules)

Apply these to every change, not only to refactors. Before you write code, ask one question of each piece you touch: **should these pieces change together?** There are three ways to get it wrong.

**Hidden links.** Pieces that must change together, where the code does not show it.

- Copies of logic or values. Write the rule once and import it.
- A module that reads a global or file set by another module. Pass the value in.
- One feature split across folders by layer. Keep a feature's code together.
- A call order or convention callers must know. Make the API enforce it.

**Needless links.** Pieces tied together that change for different reasons.

- Callers that depend on internals. Expose a small interface.
- Stable code that imports volatile code. Depend on what changes less.
- A general function with a parameter only one caller understands. Move that knowledge to the caller.
- A shallow module whose interface changes with its internals. Make it deeper or remove it.

**Surplus.** Pieces with no reason of their own to change.

- Pass-through wrappers. Remove them.
- Config or extension points for things that never vary. Remove them.
- Dead code. Remove it.

**Special cases.** An `if` for one value, a parameter for one caller, a swallowed exception, a retry or sleep, or a disabled test. Each one is a requirement the design does not cover. Change the design so the case follows from it. Do not patch cases one by one.

Keep a decision log for structural work. List the problems first, then write each fix above the problems it solves. Done means a typical change lands in one place, and no module imports anything more volatile than itself.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
