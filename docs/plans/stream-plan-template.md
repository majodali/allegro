---
type: stream-plan
template: true
status: draft
backlog: B-000
lane: X
merge: human-gated
oracle:
  - npm test
  - npm run lint:docs
chunks: [X1, X2, X3]
reserves: [B-000]
boundary:
  - docs/plans/<this-plan>.md
---

# <Outcome, as a noun phrase> — the <name> stream

> **Template** (B-166, the stream-plan document type). Copy this file
> to `docs/plans/<outcome-name>.md`, replace every angle-bracket
> placeholder, delete `template: true`, append the plan's row at the end
> of the table in `docs/plans/README.md`, and create the stream's
> section `## Stream <lane> — <name>` in `docs/CHANGELOG.md` directly
> above `## Unstreamed`, all in the plan's PR (B-162 (conflict-free
> status documents): `docs/backlog.md` §"Status documents under
> streams"). The header above is the part a coordinating
> service reads; `npx tsx scripts/stream-plan.ts --check` refuses a
> header whose lane, backlog ids or oracle commands do not exist. The
> rest is `docs/book/process.md` §4's plan shape, with the sections a
> stream needs in the order a session reads them.
>
> **Status: draft** — <who ratified what, when>. The status line and
> the header's `status` say the same thing (K-007: draft → active →
> closed → the backlog entry | superseded by X, because Y).
>
> **Reader**: <who runs this stream, what they are assumed to know, and
> where that is defined>. Terms defined in §1.

## Header fields

| Field | Meaning |
|---|---|
| `type` | always `stream-plan` |
| `status` | the K-007 status, the same as the status line |
| `backlog` | the backlog item the stream delivers |
| `lane` | the lane letter from the lane table in `docs/backlog.md` §"Parallel lanes" — the stream edits only that lane's files |
| `merge` | `merge-on-green` only when the maintainer ratified it for this stream under deviation D-2 (merge-on-green streams) of `docs/classification.md`; otherwise `human-gated` |
| `oracle` | the commands whose outcome decides a chunk — `npm test`, `npm run <script>` or `npx tsx <file>`; a stream with no mechanical oracle cannot be merge-on-green |
| `chunks` | the chunk ids in landing order, letters then a number |
| `reserves` | the backlog ids this stream mints, reserved here before it starts so two streams never mint the same id; each must already have an entry |
| `boundary` | optional globs narrowing the lane's files in `scripts/analyze/lanes.json`; omit to inherit the lane's. `npm run lint:lanes` refuses a PR of this stream whose files fall outside it (B-163 (the lane manifest and its check)) |

## 1. Outcome and terms

<The one outcome the stream reaches, stated so that a reader can tell
whether it is met. Then each term this plan uses with a meaning neither
the methodology vocabulary nor the project's vocabulary defines, one
sentence each, with a `def-` anchor at the definition site.>

## 2. The problem, measured

<The requirement, the challenge, and the measurement that shows the
gap: question, what each outcome would mean, method, result.>

## 3. Oracle and stop conditions

<What decides each chunk, mechanically: the commands in the header,
what each must report, which pins (`// expect:` lines, baselines,
counts) must not move. Then the stop conditions: the four of
`docs/book/process.md` §3 (a failed check, a scope change, a chunk
needing a decision, a chunk with asks) and any the stream adds.>

## 4. File boundary

<The lane and, if narrower, the globs in the header; the files the
stream may not touch even inside the lane, and why.>

## 5. Chunk sequence

| Chunk | Backlog | Deliverable | Oracle |
|---|---|---|---|
| X1 | B-000 | <what lands> | <what the oracle must say> |

## 6. Rulings

<Decisions the maintainer takes before or during the stream, each
with its options, the recommendation, and once taken, the ruling and
its date.>

## 7. Record

<One entry per chunk as it lands: date, what landed, what the oracle
reported, what differed from the plan.>
