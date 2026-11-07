---
type: stream-plan
status: active
backlog: B-183
lane: P
merge: human-gated
oracle:
  - npm test
  - npm run test:shards
  - npm run lint:load
  - npm run lint:units
  - npm run lint:planes
  - npm run lint:docs:check
  - npx tsx scripts/doc-ref-lint.ts
  - npm run lint:streams
  - npx tsx scripts/analyze/lane-lint.ts
chunks: [TC1]
reserves: [B-183]
boundary:
  - src/grammar2/engine.ts
  - src/test/grammar2-engine.ts
  - docs/plans/trailing-comment-dedent.md
---

# The dedent after a trailing comment — the trailing-comment-dedent stream

> **Status: active** — drafted 2026-11-07 in the PR of its one chunk,
> TC1, and ratified together with that chunk at the merge of the PR,
> under ruling R4 (B-183's lane) of `docs/plans/pilot-findings.md` §6,
> which ruled the route and measured the fix. The plan closes at that
> merge. The status line and the header's `status` say the same thing.
>
> **Merge policy.** Lane P's streams merge on green where the
> maintainer so ratified (deviation D-2 (merge-on-green streams) of
> `docs/classification.md`). This one is human-gated: its PR waits for
> the maintainer.
>
> **Reader**: the maintainer reviewing chunk PF1 (the dedent after a
> trailing comment) of the pilot-findings stream. Assumed known: the
> pilot-findings plan's §2.4, which this plan quotes and does not
> repeat, and the layout terminals of `docs/book/grammar-formalism.md`
> §5. This plan exists to carry PF1 in lane P; it does not re-plan the
> fix.

## 1. Outcome and terms

**Outcome.** B-183 (a trailing comment breaks a contract body's parse)
is met when all of these hold: the README's taste, as the book pass
printed it with the comment trailing the body's last line, parses and
verifies; every failing row of the pilot-findings plan's §2.4 table
parses; and no CLI output, `// expect:` line or gated parse count
moves.

**Terms.** None. The plan uses the layout terminals (`NEWLINE`,
`INDENT`, `DEDENT`, `CONT_NL`) as `src/grammar2/engine.ts` and
`docs/book/grammar-formalism.md` §5 define them.

## 2. The problem, measured

The pilot-findings plan's §2.4 holds the reproduction, the table of
gaps and the candidate, measured on `origin/main` at `a8e19c8`. In its
words:

> After the last statement the separator fails (its `NEWLINE` lands on
> a column other than the block's), so `DEDENT` is tried at the
> position right after `x + y`, before the comment. `DEDENT`
> (`src/grammar2/engine.ts:794` to `:807`) asks `skipToNextContent`
> (`:722` to `:745`) for the next content's column, and that function
> assumes it starts at a line start: it counts the gap as leading
> indentation (`:729` to `:736`) and stops at `/`, so it answers column
> 3 for a gap of 3, and `col >= top` refuses the dedent (`:802`). A
> comment-only line fails the same way, the comment counting as
> content.

The line numbers hold on `origin/main` at `b5eac65`, this plan's base.
The candidate measured there: in `DEDENT` only, skip horizontal
whitespace and a `//` comment to the end of the line, and any following
line holding only a comment, before measuring. Every failing probe
parsed, 136 of 136 CLI outputs were identical, and every parse count
was unchanged.

## 3. Oracle and stop conditions

The chunk is decided by these checks:

1. **The suite is green.** `npm test` and `npm run test:shards` pass;
   `bash scripts/typecheck.sh` is clean (the header omits it: its
   grammar admits `npm test`, `npm run <script>` and `npx tsx <file>`
   only). No `// expect:` line and no existing assertion changes.
2. **Outputs identical.** Every `tests/*.alg` and `demos/**/*.alg`
   through the CLI as `run`, `inspect` and `verify`, before and after:
   stdout, stderr and exit code identical.
3. **The ratchets hold.** `npm run lint:load` at the baseline, every
   parse count unchanged; `npm run lint:units`, `npm run lint:planes`.
4. **The documents hold.** `npm run lint:streams`,
   `npm run lint:docs:check`, `npx tsx scripts/doc-ref-lint.ts`.
5. **The lane holds.** `npx tsx scripts/analyze/lane-lint.ts --base
   origin/main`, with the PR's title in `PR_TITLE`, reports lane P via
   this plan and no file outside the boundary. This plan's `backlog:
   B-183` outranks the reserves of `docs/plans/book-pass.md` and
   `docs/plans/pilot-findings.md` (a `backlog` match ranks above a
   `reserves` match in `declarationRank`).

**Stop conditions.** The four of `docs/book/process.md` §3: a failed
check, a scope change, a chunk needing a decision, a landing summary
with asks. Two more: any output difference in check 2, and any parse
count that moves in check 3. Either is reported, not fixed.

## 4. File boundary

Lane P (performance stream), narrowed by the header's `boundary`:
`src/grammar2/engine.ts` takes the fix, in `DEDENT` only;
`src/test/grammar2-engine.ts` takes the tests. The status documents
under B-162 (conflict-free status documents) are shared and exempt.

**Outside the boundary, on purpose:**

- `skipToNextContent` stays as it is: it also serves `NEWLINE`,
  `INDENT` and `CONT_NL`, which were not probed.
- `src/grammar2/base-grammar.ts` and `lib/contracts.alg`: the fault is
  in neither.
- `docs/book/**`: the book pass edits it. The claims that state the
  old behaviour are listed in the PR body for it, as ruling R5 (who
  re-syncs the IR claims) of the pilot-findings plan takes them.
- `docs/plans/pilot-findings.md`: lane D's. Its §7 records PF1's merge
  in lane D's next PR.

## 5. Chunk sequence

| Chunk | Backlog | Deliverable | Oracle |
|---|---|---|---|
| TC1 | B-183 | **The dedent after a trailing comment.** `DEDENT` skips the rest of the current line when it holds only whitespace and a `//` comment, and any following line holding only whitespace and a comment, then measures the next content's column as before. Tests in `src/test/grammar2-engine.ts`: each row of the pilot-findings plan's §2.4 table in blocks indented 2 and 4, the record's minimal case through the file runner, and a comment-only line inside a block | the §2.4 probes parse; suite green; outputs identical; `npm run lint:load` at the baseline |

## 6. Rulings

None. Ruling R4 of the pilot-findings plan is this plan's ruling: it
chose the lane and the route, and its §2.4 measured the fix.

## 7. Record

- **2026-11-07 — TC1 landed** (PR #172), with this
  plan; the plan closes at that PR's merge. `DEDENT` in
  `src/grammar2/engine.ts` calls a new `skipTrailingComments`, which
  skips the rest of the line when it holds only whitespace and a `//`
  comment, and every following line holding only whitespace and a `//`
  comment; if the line holds other content, the old measurement stands.
  `skipToNextContent` is unchanged. 21 tests named "(B-183)" in
  `src/test/grammar2-engine.ts`; 11 of them fail on `origin/main`, in
  the pattern §2.4 of the pilot-findings plan measured (in a block
  indented 2, gaps 2 to 4 fail; indented 4, gap 4 fails). The oracle:
  204 of 204 CLI runs identical (`run`, `inspect` and `verify` over the
  68 programs); `npm run lint:load` at the baseline, every parse count
  unchanged; `npm run test:shards` 1,321 of 1,321 test runs, gate
  passed; the lane check reports lane P via this plan.
- **Differed from the plan.** The pilot-findings plan's §7 line
  recording PF1's merge is not in this PR: the lane check refuses
  `docs/plans/pilot-findings.md`, which is outside lane P, so lane D's
  next PR (PF2's) writes it. Found and left: a trailing `/* … */` block
  comment after a gap as wide as the block's indentation still fails
  to parse; the chunk was measured for `//` only.
