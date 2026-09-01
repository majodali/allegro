# Allegro — Process & Engineering Guide

> **Tier 0 — Constitution.** This document changes rarely, only with explicit
> maintainer sign-off, and always in a dedicated PR. It defines how work on
> Allegro happens — for human contributors and AI agents alike.

## 1. Documentation map

Every piece of content has **exactly one home**, chosen by how often it
changes and who must approve changes. Documents **link** to each other; they
never duplicate content — duplication is how documentation rots.

| Tier | Document | Purpose | Changes |
|---|---|---|---|
| 0 | `docs/VISION.md` | Goals, thesis, design principles | Rare; maintainer sign-off; dedicated PR |
| 0 | `docs/PROCESS.md` | This document | Rare; maintainer sign-off; dedicated PR |
| 1 | `docs/design/*.md` | Durable design truth per area (type system, effects, grammar, proofs, …) | With the implementing/deciding change, same PR |
| 1 | `docs/grammar-formalism.md` | Grammar 2 formalism spec | Same as design docs |
| 1 | `docs/proving-in-allegro.md` | Participant-neutral proving primer (consumed by humans and the PCP LLM worker) | Same as design docs |
| 2 | `docs/backlog.md` | What's next, debt register, research questions | Freely, before every commit that affects it |
| 2 | `docs/CHANGELOG.md` | What landed, when, with what design notes | Append per landed chunk |
| 2 | `docs/plans/*.md` | Implementation plans (transient; see §4) | Freely; lifecycle below |
| 3 | `CLAUDE.md` | Agent session contract: build/run, architecture map, invariants & gotchas, pointers | When commands, invariants, or architecture change — not for history |
| — | `.claude/memory/*` | Session/user context only (see §8) | Freely, with the promotion rule |

Three content types, three homes:

- **Design rationale & decisions** (durable) → `docs/design/`
- **Implementation plans** (transient) → `docs/plans/`
- **Status & history** (append-only) → `docs/CHANGELOG.md` + `docs/backlog.md`

A plan file must not become the only record of a design decision; a status
narrative must not live in CLAUDE.md; a design decision must not exist only
in a memory file.

## 2. Tier-0 change policy

- Tier-0 documents change in a **dedicated PR**, explicitly flagged as a
  constitution change, with maintainer sign-off. Never bundled with feature
  work.
- Agents may **propose** Tier-0 edits (as a draft or PR) but never land them
  silently as part of another task.
- When implementation reality contradicts a Tier-0 statement, the
  contradiction is surfaced to the maintainer — not resolved unilaterally in
  either direction.

## 3. Feature lifecycle

1. **Design discussion first.** For anything non-trivial, the design is
   discussed and the outcome recorded as a delta to the relevant
   `docs/design/` doc (or a new one) *before* implementation. Discussion is
   part of the work, not overhead.
2. **Plan, then chunks.** Larger features get a plan doc (§4). The
   maintainer decides chunk boundaries — don't start chunk 1 without an
   explicit go-ahead.
3. **Stay close on current work.** Deliver in tight increments: land a
   chunk, summarize what changed, stop. Don't chain multiple chunks without
   confirmation. "Great work" without "next" means discuss before
   continuing.
   **Per-lane exception (2026-08).** Lanes declared "pre-ratified" in
   `docs/backlog.md` §"Parallel lanes" run a maintainer-approved chunk
   SEQUENCE: the chunk list is agreed once at the start of the arc, and
   the lane lands the chunks in order without stopping between each.
   Stop-and-summarize still applies at the end of the sequence, and
   immediately at any point where the work diverges from the agreed list
   — a chunk that turns out to need a decision is a stop, not a judgment
   call. Lanes not declared pre-ratified keep the per-chunk gate above.
   The landing checklist (§5) is unchanged for every lane.

   **The PR is the gate (2026-09).** A merged PR is the maintainer's
   approval. Nothing else is.
   - An open question does not open a new branch. Update the same branch,
     then update the PR description to match.
   - A new branch waits for the current PR to merge. Starting the next
     chunk on a fresh branch while a PR is open splits the review across
     two branches.
   - The maintainer reviews and merges at any time, without checking which
     branch is in flight. That is expected. The discipline sits on the
     agent's side, not the maintainer's.

   Motivated by 2026-09-01: a session opened a PR against a stale
   `origin/main` after the maintainer had already merged that branch's
   earlier work. The description claimed 41 commits; the diff held two.
4. **Land with the checklist** (§5) — every chunk, same PR/commit.

**Deviation rule.** If implementation diverges from the plan or a design doc
— a different mechanism, a descoped piece, a changed surface — the doc is
updated *in the same commit*. Divergence recorded nowhere is the
fragmentation mechanism this process exists to kill.

## 4. Plan documents (`docs/plans/`)

- **Naming: descriptive**, matching the terminology of the design docs and
  backlog, with plan/sequence identifiers where meaningful. Examples:
  `effects-slice2-stage-f.md`, `planning-dsl-1-model.md`,
  `phase-i-js-codegen.md`. (Supersedes the earlier evocative-codename
  convention — codenames are unguessable for the next reader.)
- **Manifest.** `docs/plans/README.md` lists every plan: name, topic,
  status, related backlog items. Agents read the manifest first.
- **Header** on every plan: `Status: draft | active | landed | superseded`,
  related backlog items, design docs it touches.
- **Template sections:** Context → Settled decisions → Out of scope →
  Chunks → Verification → Doc-update checklist (which design docs /
  CHANGELOG / BACKLOG entries this work must touch on landing).
- **Lifecycle.** Draft → active (maintainer approved) → landed/superseded.
  Landed and superseded plans move to `docs/plans/archive/` once their
  durable content has been promoted to design docs and their pending items
  extracted to the backlog. The archive is history — never an input to new
  work.

## 5. Landing checklist (definition of done)

Before every commit that lands functionality:

- [ ] `npx tsc --noEmit` clean
- [ ] `npx tsx src/test.ts` — all tests pass
- [ ] New behavior covered by tests; user-visible features get a demo
      `tests/*.alg` with `// expect:` comments
- [ ] `docs/CHANGELOG.md` entry (what landed, key decisions, deviations)
- [ ] `docs/backlog.md` updated (items ticked/moved; new debt or follow-ons filed)
- [ ] `docs/design/*` updated if the design or its implemented/designed
      status changed
- [ ] `CLAUDE.md` updated **only** if commands, invariants, or the
      architecture map changed
- [ ] Plan doc status updated
- [ ] Website sandbox updated for user-visible features (see §9)

## 6. Code quality guidelines

**Tests**

- Add new test conditions freely — strengthening coverage never needs
  permission.
- **Never remove or change an existing test condition without discussing
  first** — including assertions, expected outputs, `// expect:` comments in
  `.alg` files, and structural setup. A failing test is a signal (real bug,
  outdated assumption, or a previous misunderstanding worth surfacing);
  silently "fixing" the test discards it. If a test really is wrong, propose
  the change in plain text and wait.
- Investigate root causes; don't accept "known issues" unless truly known,
  isolated, and tracked with a planned remediation.

**Naming**

- No stuttering names (`TypeType`, `NamedType.NamedType`) — pick a different
  word for one of them.
- Tier names are locked: Allegretto, Allegro Standard, Allegro Vivace. No
  new Italian musical terms for sub-tiers, modes, or extensions.
- Flat sequence numbering (`D1, D2, D3`), never primes (`D'`).

**Evaluator & runtime invariants** (the recurring lessons; the complete
gotcha list lives in `CLAUDE.md`):

- Eager primitives receive **full values** (channels intact — C4.3c
  transparency); impls read data through `dataOf`/`asBits`. `lazy` is
  purely an evaluation-control choice (receive arg ASTs + evalFn). The
  propagation table alone governs channel behavior — never hand-roll
  per-channel logic in an impl.
- Every code path that clones a `ComposedFunction` must preserve its
  metadata (`__genericParams`, `__effectVarParams`, params/owner remapping).
  Use the shared helpers; never hand-clone.
- Wrappers in function bodies (`type_check`, the `*_attach` family) must
  forward TailCall sentinels and be peelable by the shared
  `findAttachWrapper` helper — never add a bespoke peeler.
- **No new meta-property on type/value Contexts without registering it** in
  the meta-protocol registry in `docs/design/standard/type-system.md` (name, owner,
  contract, lifecycle). The `__`-prefix convention is an accreted artifact
  under revision — follow the registry's current guidance.

**Structure**

- No new monolithic dispatch files; prefer table/registry-driven dispatch
  and labeled extraction over positional child-searching in parse trees.
- Keep generated files untouched (`src/parser.ts` is generated;
  `// @ts-nocheck` stays).

## 7. Agent operating rules

- Start from `CLAUDE.md`; follow its pointers. Read the plans manifest
  before starting feature work; read the relevant `docs/design/` doc before
  changing an area.
- Respect the lifecycle (§3): plan-first for new features, stay-close for
  current work, stop between chunks.
- Never land Tier-0 changes; propose them.
- When code and documentation disagree, **surface the conflict** — don't
  silently pick a side. When two documents disagree, the higher tier wins
  until the maintainer rules.
- Run the landing checklist (§5) before every commit. The "update docs
  before commit" rule means updating the *right* doc: CHANGELOG for history,
  design docs for design deltas, BACKLOG for status, CLAUDE.md only for
  invariants.
- Parallel sessions: work is organized into LANES (`docs/backlog.md`
  §"Parallel lanes") — a lane is a set of items that edit the same files,
  so two lanes can run concurrently without colliding. Before starting:
  confirm which lane you are in, and check open PRs for overlapping work;
  if found, flag it rather than duplicating. Sessions cannot see each
  other's uncommitted work, so a collision surfaces only at merge —
  staying inside the lane's files is the mechanism, not a courtesy. An
  item that turns out to need files outside its lane is a stop: re-scope
  it with the maintainer rather than reaching across.

## 8. Memory files (`.claude/memory/`)

Memory is for **session and user context**: user preferences and working
style, external context (e.g. deployment accounts, experiments outside the
repo), and narrative state pointers.

**The promotion rule: before writing a memory file, consider whether the
content has a more permanent home.**

- Design decisions → `docs/design/` (or propose for `docs/VISION.md`)
- Process rules and feedback about how to work → propose for
  `docs/PROCESS.md`
- Status and history → `docs/CHANGELOG.md` / `docs/backlog.md`

If content is promoted, the memory file shrinks to a 2–3 line pointer to the
canonical location. Memory is never the canonical source for design or
process — an agent reading only `docs/` must not miss anything binding.

## 9. Website loop

allegrolang.org (S3 + CloudFront; files under `website/`; `deploy.sh` syncs
and invalidates) is the maintainer's primary sandbox, not just marketing.

- When a user-visible feature lands, update the website in the same cycle
  with a sandbox example.
- New grammar libraries must be registered via `Allegro.registerLibrary` in
  the web bundle (a "Grammar library 'X' not registered" sandbox error means
  this was forgotten).
- **Lead with provability + safety** in site framing — don't bury the lede.

## 10. Enforcement & tooling

- **CI** (to be added — tracked as debt): `tsc --noEmit`, the full test
  suite, and a doc-reference lint (every `docs/…`, `docs/plans/…`,
  `.claude/memory/…` path mentioned in tracked docs must resolve — dangling
  references are how this project lost its thesis document for months).
- Git identity in remote sessions: `Claude <noreply@anthropic.com>` for
  commits authored by agents. Never rewrite the maintainer's commits on
  shared history.
- Commits follow the chunk structure: one chunk, one commit, message naming
  the plan/phase it belongs to.

---

*Sources: consolidated from `feedback_phase_delivery`,
`feedback_test_modification`, `feedback_naming_conventions`,
`feedback_claude_md`, `feedback_backlog_md`, `feedback_review_and_redo`,
`project_website_loop` (memory), plus the 2026-06 project review. Plan-doc
naming changed from evocative codenames to descriptive names per maintainer
direction (2026-06).*
