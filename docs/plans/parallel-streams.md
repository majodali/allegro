---
type: stream-plan
status: active
backlog: B-165
lane: S
merge: human-gated
oracle:
  - npm test
  - npm run lint:docs
  - npm run lint:streams
chunks: [S1, S2, S3, S4, S5]
reserves: [B-162, B-163, B-164, B-165, B-166]
boundary:
  - docs/**
  - scripts/stream-plan.ts
  - scripts/doc-lint.ts
  - scripts/analyze/lanes.json
  - src/test/tooling.ts
  - .github/workflows/ci.yml
  - package.json
  - CLAUDE.md
---

# Parallel streams — the pre-stream arc

> **Status: active** (2026-10-30). The five blocking items the maintainer
> ratified on 2026-10-30 before development runs as several concurrent
> streams, in the order ratified: the deviation record first, then the
> stream-plan document type, then the status documents, the lane
> manifest and the ratchet baselines. Chunks S1 and S2 landed; §6 is the
> record. The header above is this plan's own stream-plan header (S2).
> Backlog owners: B-165 (merge-on-green recorded as a deviation),
> B-166 (the stream-plan document type),
> B-162 (conflict-free status documents),
> B-163 (the lane manifest and its check),
> B-164 (ratchet baselines under concurrent merges).
>
> **Reader**: someone who knows the lane model of `docs/backlog.md`
> §"Parallel lanes" and the gate of `docs/book/process.md` §5, and has
> not run a stream. Terms defined in §1.

## 1. Outcome and terms

**Outcome.** Two or more streams work the repository at once, each
under its own plan, without a merge conflict on the status documents,
without an unseen file collision, and without a merge that breaks main;
and a stream that qualifies merges its own PRs on a green gate, the
practice that deviation D-2 (merge-on-green streams) records.

The performance stream (B-157 (the performance stream),
`docs/plans/fast-library-load.md`) ran alone and proved the working
model: a plan with an oracle, implementation delegated per chunk, every
diff read, merge on green, ten chunks without a collision. A second
concurrent stream would hit the five gaps of §3.

**Terms**, ratified 2026-10-30:

- <a id="def-stream"></a>**Stream**: a sequence of sessions working
  one lane under one stream plan. A *lane* (`docs/backlog.md`
  §"Parallel lanes") is the set of files and items; a stream is the
  lane in motion.
- <a id="def-stream-plan"></a>**Stream plan**: the plan document a
  stream runs from. It declares the outcome, the oracle, the file
  boundary, the stop conditions, the merge policy, the ratified chunk
  list and the backlog ids the stream reserves, and it opens with a
  machine-readable header carrying the last five. Chunk S2 (B-166)
  defined the type: the template `docs/plans/stream-plan-template.md`
  documents the header's fields and the sections; `npm run
  lint:streams` (`scripts/stream-plan.ts`) refuses a header whose lane,
  backlog ids or oracle commands do not exist; the first instances are
  `docs/plans/fast-library-load.md` and this plan.
- <a id="def-lane-manifest"></a>**Lane manifest**: the machine-readable
  declaration of each lane's file globs, which a check reads. Chunk S4
  (B-163) creates it.

A *coordinating service* in this plan is the project-orchestrator
project, which the maintainer intends to take over parts of the
coordination, now or over time. One principle governs the split: the
service holds process state (which stream is active, which PR is open,
when to check in) and never project truth. K-001 (the authoritative
record lives in the repository) keeps everything authoritative under
`docs/`, so whatever the service derives is
re-derivable from the repository, and every repository-side mechanism
still works when a human session runs without the service or the
service is down.

## 2. The split, ratified 2026-10-30

| Item | Repository, now | Coordinating service, later |
|---|---|---|
| Status documents (S3, B-162) | A section per stream in the changelog; item edits confined to their own bullet | The single writer: at merge it appends the PR's "What changed" part under the stream's section, so streams stop editing status documents |
| Lane manifest (S4, B-163) | The manifest in the repository; a CI check that a PR's diff stays inside its lane | Reads the manifest at dispatch and refuses to start a stream whose globs overlap an active one |
| Ratchet baselines (S5, B-164) | The up-to-date branch rule (an owner setting); a baseline lowers only in a follow-up commit after rebase | A serialized merge queue, which makes the rule redundant |
| Merge-on-green (S1, B-165) | Deviation D-2 (merge-on-green streams) in `docs/classification.md` with its four conditions | Enforcement: merges only a stream whose plan declares the policy, holds every other PR for the maintainer |
| Stream plan (S2, B-166) | The document type with a small machine-readable header | Consumes the header as the brief; mints backlog ids centrally |

The migration adds no repository work: each service-side part replaces
a rule, not a mechanism.

## 3. The gaps, and the oracle

1. **Status documents conflict.** `docs/CHANGELOG.md` is newest first,
   so every stream inserts at the same line and every second merge
   conflicts. The lane table and the plans manifest have the same shape.
2. **Lane boundaries are prose.** A collision between two streams
   surfaces only at merge (`docs/backlog.md` §"Parallel lanes", the
   closing paragraph).
3. **Ratchet baselines race.** `scripts/analyze/plane-baseline.json`,
   `scripts/analyze/units-baseline.json`, `bench/load-baseline.json` and
   `src/boundary-baseline.json` are committed numbers. Two streams
   lowering one file conflict, and a merge can pair one stream's lowered
   baseline with another stream's new count and break main.
4. **Merge-on-green is unrecorded.** W-006 (single-use branches, a PR
   for owner review) says a PR waits for owner review,
   `docs/book/process.md` §3 says a merged PR is the maintainer's
   approval and nothing else is, and the performance stream merged on
   green under ruling R3 (the stream's merge policy) of its plan, taken
   in conversation. The
   deviation register of `docs/classification.md` said "no deviations
   recorded".
5. **No brief a service can hand a session.** The fast-library-load
   plan has the shape; nothing names the shape as a document type.

**Oracle.** Each chunk is docs or tooling; the suite and the lints are
the gate as for any chunk, and S4 adds a check that is probed against a
known-bad diff before it is trusted (the B-128(a) lesson). The arc's
own outcome is checked by its first use: two streams run concurrently
and the five gaps do not recur.

**Stop conditions.** Those of `docs/book/process.md` §3 (a failed check,
a scope change, a chunk needing a decision, a chunk with asks). This
arc is NOT a merge-on-green stream: it edits the process documents, so
each PR waits for the maintainer.

## 4. Chunk sequence (ratified 2026-10-30)

| Chunk | Backlog | Deliverable |
|---|---|---|
| S1 | B-165 | Merge-on-green recorded as deviation D-2 in `docs/classification.md` with its four conditions and its retirement condition; the lane table's gate-policy paragraph points at it; the `docs/book/process.md` §3 contradiction surfaced with proposed text (§5), for a dedicated Tier-0 PR on sign-off; this plan and the five backlog items |
| S2 | B-166 | The stream-plan document type: named in `docs/documentation-census.md` §1, a template in `docs/plans/`, a machine-readable header (lane, oracle commands, merge policy, chunk list, reserved ids); `docs/plans/fast-library-load.md` conformed as the first instance |
| S3 | B-162 | `docs/CHANGELOG.md` restructured with a section per stream; the rule that a stream's backlog edits stay inside its own items and its lane row; the rebase-before-merge rule in the landing checklist's lane notes |
| S4 | B-163 | `scripts/analyze/lanes.json`, the lane manifest; `npm run lint:lanes`, a check that a PR's changed files stay inside the lane its branch or plan declares, the shared status documents exempt; in CI on pull requests; probed against a known-bad diff |
| S5 | B-164 | The baseline-lowering rule (a baseline lowers only in a follow-up commit after rebase) in `CLAUDE.md`'s invariant list and the lane notes; the owner's branch-protection setting recorded in `docs/classification.md` once flipped |

## 5. Amendment to `docs/book/process.md` §3 (Tier 0, landed)

`docs/book/process.md` is Tier 0; an agent proposes, the maintainer
lands (§2). The proposal, appended after "The PR is the gate (2026-09)"
and its three bullets, in the dedicated PR #117 — signed off and merged
2026-10-30 with this text, "D-2" written "D-2 (merge-on-green
streams)" for the doc lint:

> **Merge-on-green streams (2026-10).** A stream whose stream plan
> declares merge-on-green, and that the maintainer has so ratified,
> merges its own PRs: the agent running the stream merges a PR once the
> gate is green and it has read the diff. The policy applies only while
> the stream meets four conditions — a mechanical oracle decides each
> chunk, no ruling is open inside the chunk, the chunk's files are
> disjoint from every other active lane, and the chunk is reversible by
> revert — and a chunk that fails any one of them waits for the
> maintainer like any other PR. The four stop conditions above are
> unchanged. Recorded as deviation D-2 in `docs/classification.md`
> until the pinned methodology version carries the rule.

## 6. Record

- **S1 — landed 2026-10-30.** D-2 recorded in `docs/classification.md`;
  the lane table and its gate-policy paragraph updated; the five
  backlog items filed under Track M; §5 drafted; the terms of §1
  defined here as their definition site.
- **S2 — landed 2026-10-30.** The stream-plan document type: the
  header (YAML front matter, a fixed subset) with `type`, `status`,
  `backlog`, `lane`, `merge`, `oracle`, `chunks`, `reserves` and an
  optional `boundary`; the template
  `docs/plans/stream-plan-template.md`; the reader and check
  `scripts/stream-plan.ts` (`npm run lint:streams`, in the suite via
  `src/test/tooling.ts`, probed against a known-bad header); the type
  named in `docs/documentation-census.md` §1; `docs/doc-lint.ts`'s
  bare-identifier check skips front matter the way it skips a table, so
  the first prose use still names. First instances: this plan and
  `docs/plans/fast-library-load.md`, which gains the header as a closed
  stream. The definition of *stream plan* stays in §1 here, the type's
  definition site, rather than moving: the census row cites it. The
  Tier-0 amendment of §5 is PR #117, opened and merged the same day.
