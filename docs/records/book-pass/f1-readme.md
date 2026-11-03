# Chapter review: Introduction, the root README (F1)

> **Record.** Reader: RD-2 (the owner returning after a gap). Form:
> W-008 (reports map their deliverables). Subject: chunk F1 of
> `docs/plans/book-pass.md`, the chapter `README.md` (I.1, unit(s)
> none), read on `origin/main` at `7e80fdf`, 2026-11-03.
> Author: the review session. The maintainer reads the chapter and this
> review together and rules by number; "defaults" takes every
> recommendation.

## Asks

The README's taste example does not parse as printed. Six rows of §1
are wrong: two need an editorial fix (rows 3 and 6), four a corrected
claim (rows 1, 9, 13 and 14). No lane holds `README.md`, so the route of the fixes is the
first ask. Under R9 (the three chapters this stream may not edit),
option (a), every edit below is an ask.

1. **R-F1-1 — How do the three editorial fixes of §2 land?** Options:
   (a) one lane-S PR by the orchestrating session that also adds
   `README.md` and `demos/rung1/README.md` to lane S's globs in
   `scripts/analyze/lanes.json`; (b) the maintainer edits, in an
   [unstreamed PR](#def-unstreamed-pr); (c) leave. Recommended: (a),
   because a lane-S PR without the globs fails the lane check (§2),
   and with them later README edits are checked too. Default: (a).
2. **R-F1-2 — Which Node version does README require (`README.md:26`)?**
   Options: (a) "Node.js 22 or later", the version CI runs; (b) "20.11
   or later", the floor the suite's code needs; (c) keep "18+" and file
   a code change to run the suite on 18. Recommended: (a), because 22
   is the only version any check runs. Default: (a).
3. **R-F1-3 — Reword "No boolean "verified" anywhere" (`README.md:15`).**
   Options: (a) "No claim is a bare yes or no: each resolves to a
   tier"; (b) leave. Recommended: (a), because the verdict carries a
   boolean `verified` and prints it. Default: (a).
4. **R-F1-4 — Correct the rung-1 description (`README.md:65-69`).**
   Options: (a) "four runnable scenes and a walkthrough of the prover
   loop; three carry a "break it" block and a captured transcript", the
   same fix at `demos/rung1/README.md:4` and `:21`; (b) add break-it
   blocks to scenes 1 and 5, a demo change outside this stream; (c)
   leave. Recommended: (a). Default: (a).
5. **R-F1-5 — File the parse defect of §7 as B-183 (first out-of-scope
   finding of the book pass).** Options: (a) this review's PR rewrites
   B-183's placeholder in `docs/backlog.md`; (b) record it here only.
   Recommended: (a), because a reader who copies the taste hits it.
   Default: (a).
6. **R-F1-6 — Link README's terms to their definition sites?** Options:
   (a) leave them unlinked; (b) link the eight of §3. Recommended: (a),
   because README orients a visitor and its tour points onward.
   Default: (a).
7. **R-F1-7 — No IR and no count for README in this pass.** Options: (a)
   no IR now; a non-normative IR only if README later enters a lane;
   (b) an IR now, landed with the fixes. Recommended: (a). Default: (a).
8. **R-F1-8 — README and getting-started overlap.** Options: (a) keep
   both; F2 fixes the same claims in `getting-started.md`; (b) README
   keeps the pitch, the taste and the tour, and "Status, honestly"
   lives in getting-started only. Recommended: (a). Default: (a).
9. Ratify or strike the one term under *Terms introduced*. Default:
   ratify.

## What is already covered

- The three moves (`README.md:9-22`) restate `docs/book/vision.md` §1a
  (`:51-78`) and `docs/messaging.md:25-43`, Tier 0 and its copy source.
- "Status, honestly" (`README.md:84-92`) restates
  `docs/messaging.md:123-131`.
- F1 is review only, by R9 option (a), taken at the merge of PR #154.
- The census row (`docs/documentation-census.md:65`) lists no finding.

The rest is new.

## What changed

### 1. The chapter against the code

| # | The chapter says | The code does | Pointer | Verdict |
|---|---|---|---|---|
| 1 | "Requires Node.js 18+" (`:26`) | The suite calls `import.meta.dirname`, absent before Node 20.11; no `engines` key; CI runs 22 | `src/test/tooling.ts:107`, `src/boundary-tests.ts:58`, `.github/workflows/ci.yml:35` | wrong (by inspection; not run on 18) |
| 2 | clone, `npm install`, REPL, run `basics.alg`, `npm test` (`:29-35`) | All present; `basics.alg` exits 0 | `src/index.ts:229`, `:374`; `package.json:14` | holds |
| 3 | The taste (`:41-52`) runs | Parse error at the comment on `:49`; without it, verify reports "1/1 discharged" | run 2026-11-03 | wrong |
| 4 | Breaking a claim "halts the build with a concrete counterexample" (`:38`) | `== 7` halts: "proposition is false (counterexample: …)", exit 1 | run 2026-11-03 | holds |
| 5 | "both checks discharge statically" (`:49`) | inspect shows `x ≥ 1` and `_ ≥ 1`, and still lists `requires_stmt` and `ensures_check` | inspect output | unverifiable from the CLI |
| 6 | `inspect first.alg`, `verify first.alg` (`:55-58`) | The file is never named in README | `getting-started.md:38` names it | wrong (reference) |
| 7 | inspect shows types, predicates, contracts, effects, safety grade | Yes; effects when present | `src/index.ts:293`; `demos/rung1/03-effects.alg` | holds |
| 8 | verify shows theorems, law tiers, the assumption ledger | Yes | `src/pcp.ts:555`, `:648` | holds |
| 9 | "No boolean "verified" anywhere" (`:15`) | `Verdict.verified: boolean`; printed "Verdict (verified)" | `src/pcp.ts:119`, `:555` | wrong |
| 10 | Six tiers, "proven" to "pending" (`:17`) | Five tiers, `kernel` for "proven"; `pending` is a status | `src/pcp.ts:154-156`; D34 (discharging completion effects) | holds (labels differ) |
| 11 | Authorship recorded per discharged proof (`:22`) | `Authorship` on each theorem result | `src/pcp.ts:205`, `:254` | holds |
| 12 | One engine; checking and discharge are one evaluation (`:11-14`) | The design's claim | `docs/book/vision.md:57`, `:244` | holds (design) |
| 13 | rung 1: "five runnable scenes" (`:65`) | Four `.alg` files; scene 5 is a Markdown walkthrough | `demos/rung1/` | wrong |
| 14 | "each with a "break it" block and captured transcripts" (`:68`) | Blocks in scenes 2, 3, 4 only; three transcripts | `02-counterexamples.alg:18`, `03-effects.alg:27`, `04-laws.alg:19` | wrong |
| 15 | `allegro obligations` / `propose` / `prove` (`:68`) | Subcommands exist; no `allegro` binary (no `bin` key) | `src/index.ts:318`, `:330`, `:346` | holds (name is shorthand) |
| 16 | rung 2 and rung 3 (`:70-76`) | As described; libraries present | `demos/rung2/README.md`, `demos/rung3/README.md`, `lib/units.alg`, `lib/planning.alg` | holds |
| 17 | allegrolang.org: "every example editable and runnable" (`:77`) | Site answers 200; 23 editable sandboxes; two static library listings | `website/index.html:851`, `:884` | holds |
| 18 | The proving guide is the LLM prover's primer (`:79`) | Loaded by path | `pcp/llm-worker.ts:394-403` | holds |
| 19 | Effect labels module-granular; termination by structure and `decreases` (`:89-91`) | Parametric capabilities designed only; both checks present | `docs/book/standard/effects.md:56`; `src/totality.ts:83`, `:442` | holds |
| 20 | Receipts in `docs/messaging.md`; CC0 licence (`:92`, `:96`) | Both present | `docs/messaging.md:111`; `LICENSE:3` | holds |

Counts: 20 rows; holds 13, wrong 6, stale 0, unverifiable 1.

### 2. Links and references

All nine links resolve. No link carries an anchor, so no `def-` link
exists. The editorial fixes, for R-F1-1:

1. `README.md:49`: move the trailing comment above `double_pos`, so the
   taste parses.
2. `README.md:38`: add "Save it as `first.alg`", the file `:55` runs.
3. `README.md:68`: say once that `allegro` stands for
   `npx tsx src/index.ts`.

The route matters. `scripts/analyze/lanes.json` lists `README.md` and
`demos/**` in no lane. A PR titled B-163 (the lane manifest and its
check), B-174 (the book's existing chapters retrofitted to IR) or B-183
fails the lane check on both files. An unstreamed PR passes unchecked.

### 3. Terms and definition sites

README defines no term and carries no `def-` anchor. It uses eight
terms whose sites are in `docs/book/concepts.md`: partial evaluation
(`:1560`), refinement (`:1916`), law (`:2095`), effect (`:2126`),
discharge tiers (`:2194`), proof and discharge (`:2221`), obligation,
verdict and the assumption ledger (`:2246`), contract (`:2300`).
A lookahead chapter may point forward, so none is a finding under
D52 (the documentation book). No site moves.

### 4. Designation, rendering and count

R3 (the designation of a chapter that has no IR) would make README
normative and rendered. An IR beside it waits for an edit this stream
may not make. README is an introduction and binds nothing, so a later
IR would be non-normative. R4 (whether the four IR-only chapters are
rendered in this pass) does not apply. Under R5 (when a stranger-round
count runs), the fixes are editorial or claim corrections, so no count
runs. R-F1-7 asks this.

### 5. Restructuring

README and `getting-started.md` repeat the tour and the status text
(`getting-started.md:89-111`), and so repeat the Node and rung-1
errors. Option (b) of R-F1-8 removes one copy of the status text. It
touches F2 only. Recommended against: GitHub shows README to a visitor
who never opens the book.

### 6. Tidy-ups found

No tidy-ups found. README is in no unit of `scripts/analyze/units.json`.

### 7. Other findings

For B-183: a trailing line comment on the last line of a contract body
(after `requires`), followed by a blank line, fails to parse. Minimal
case:

```allegro
use contracts
f(x: Int): Int =>
  requires x > 0
  x + x   // c

print(f(2))
```

The error is "Parse error at position 49". The same body parses with no
blank line, with no comment, or without `requires`. The owner is lane
P's grammar files (`src/grammar2/`) or the contracts body form in
`lib/`; not located further.

Also noted, for their owners: the "no boolean" sentence recurs in
`docs/messaging.md:31`, `website/index.html:178`, `:390`, and
`docs/book/proving-in-allegro.md:178` (chunk T1). The Node and rung-1
claims recur in `docs/book/getting-started.md:9` and `:91` (chunk F2).

## Terms introduced

- <a id="def-unstreamed-pr"></a>**Unstreamed PR**: a PR whose title
  names no backlog id that a stream plan reserves; the lane check
  reports it and checks nothing.

## Rulings taken

Added by one commit before the merge.
