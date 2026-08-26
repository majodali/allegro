# Proposed PROCESS delta — parallel lanes & the per-lane gate

Status: **approved and applied 2026-08** (maintainer sign-off in
session). Both edits below are now live in `docs/PROCESS.md`; this doc
is kept as the record of what was proposed and why, and closes here.

The maintainer also recorded intent to evaluate this as a candidate
amendment to majodali/methodology — the lane experiment is the evidence
for that decision, so the observations that accumulate against it should
be gathered before the amendment is proposed.

PROCESS.md is Tier 0 and agents never land Tier-0 changes (PROCESS §7),
so the lane model itself landed in `docs/backlog.md` §"Parallel lanes"
(Tier 2, sequencing) and only these two sentences needed sign-off.

## Why a Tier-0 delta is needed at all

The backlog can record *which* items run concurrently — that is
sequencing. It cannot, on its own, change **§3.3 "Stay close on current
work"**, which today reads:

> **Stay close on current work.** Deliver in tight increments: land a
> chunk, summarize what changed, stop. Don't chain multiple chunks without
> confirmation. "Great work" without "next" means discuss before
> continuing.

Lanes A, B and C are meant to run on a pre-ratified chunk sequence — the
maintainer approves the list once, and the lane lands the chunks in order
without stopping between each. That is a direct exception to §3.3, and
recording it anywhere other than PROCESS would be the fragmentation
PROCESS §3's deviation rule exists to prevent.

## Edit 1 (applied) — PROCESS §3, item 3

Append to the existing item (no text removed):

> **Per-lane exception (2026-08).** Lanes declared "pre-ratified" in
> `docs/backlog.md` §"Parallel lanes" run a maintainer-approved chunk
> SEQUENCE: the chunk list is agreed once at the start of the arc, and the
> lane lands the chunks in order without stopping between each. Stop-and-
> summarize still applies at the end of the sequence, and immediately at
> any point where the work diverges from the agreed list — a chunk that
> turns out to need a decision is a stop, not a judgment call. Lanes not
> declared pre-ratified keep the per-chunk gate above. The landing
> checklist (§5) is unchanged for every lane.

## Edit 2 (applied) — PROCESS §7, the parallel-sessions bullet

Replace:

> - Parallel sessions: before starting, check open branches/PRs for
>   overlapping work; if found, flag it rather than duplicating.

With:

> - Parallel sessions: work is organized into LANES
>   (`docs/backlog.md` §"Parallel lanes") — a lane is a set of items that
>   edit the same files, so two lanes can run concurrently without
>   colliding. Before starting: confirm which lane you are in, and check
>   open PRs for overlapping work; if found, flag it rather than
>   duplicating. Sessions cannot see each other's uncommitted work, so a
>   collision surfaces only at merge — staying inside the lane's files is
>   the mechanism, not a courtesy. An item that turns out to need files
>   outside its lane is a stop: re-scope it with the maintainer rather
>   than reaching across.

## Notes for the reviewer

- Both edits are additive; nothing existing is deleted except the one
  bullet replaced in edit 2, whose content is preserved inside the
  replacement.
- The lane membership itself is deliberately NOT in PROCESS — it changes
  as the codebase changes (it came from co-change measurement, and lane C
  opens only once lane B lands). Tier 2 is the right home for it.
- If the pre-ratified model proves wrong in practice, reverting is
  deleting the §3 paragraph; the lane structure stands independently.
