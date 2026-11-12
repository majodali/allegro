# Rung 4 — domain models, AI-proposed solutions, kernel-scored, ledger-carried

The ladder's rung 4 story (`docs/plans/release-track.md` §5): two or
more coupled domain models, AI-proposed candidate solutions,
kernel-scored, ledger-carried. Rung 4 is public only as labeled
direction. This folder holds its first scene, which shows one piece of
that story on one model: the loop in which a proposer, a script or a
language model, answers a domain model's obligation, and the kernel
checks every answer.

```bash
npx tsx src/index.ts demos/rung4/01-loop.alg
```

| Scene | Shows |
|---|---|
| `01-loop.alg` | The planning loop over rung 3's planning model: an open plan (`plan Fulfil from yard:`) with a hole, and its catalog (`catalog yard:`); the hole as an obligation in planning words ("nothing in the catalog produces Shipped, which Depot needs"); three proposals, each one catalog entry, and the kernel's answer to each (the next dead end, the budget missed, the plan solved); the solved plan checked as a `WellFormedPlan`; the ledger's record of it, with its bound, its entries and who proposed each, and the promise it rests on |
| `01-loop.md` | The loop run over the scene through the CLI: `obligations`, `propose`, `prove` with a scripted proposer (refused once, accepted once), and the maintainer's run with a language model (refused once, accepted once); `verify --transcript` naming each proposer in the plan ledger |

The scene has a commented **break it** block with the captured halt in
`transcripts/01-halt.txt`: the same plan declared with the strict
`plan Fulfil:` form, which halts on the hole instead of naming it. The
scene is validated by the test suite via its `// expect:` comments. The
transcripts are reproduced by a test (`src/test/pcp.ts`): the scripted
loop is run again on the scene and compared with
`transcripts/01-loop-scripted.json`, and each reply of the language
model's run is put through the kernel again and compared with the
answer the transcript records.

`transcripts/` holds:

- `01-loop-proposals.md`, the scripted proposer's prepared answers for
  the scene, and `01-loop-scripted.md` with its JSON twin, the scripted
  loop's transcript;
- `llm-planning-loop-proposals.md` and its JSON twin, the maintainer's
  run of the loop with a language model, through Claude Code on the
  maintainer's Claude subscription, on `tests/planning-loop-proposals.alg`
  (the same plan and catalog as the scene). It predates chunk L7's skip
  of the obligations the file holds no splice site for, so it also
  records requests about the units library's laws; it is the record of
  that run and is not regenerated;
- `proposals.md` and `scripted-planning-loop-proposals.md` with its
  twin, the scripted loop on `tests/planning-loop-proposals.alg`;
- `01-halt.txt`, the break-it block's halt.

What was built for the loop: the open-plan and catalog forms and the
plan obligation (`lib/planning_loop.alg`), the proposal protocol (one
catalog entry, spliced into the named catalog, refused when it edits
the plan), the loop in `pcp/llm-worker.ts` with its scripted and
language-model proposers, its time box and its transcript, and the
plan ledger. What was inherited free: rung 3's checks and searches,
which answer every proposal, and the prover protocol of rung 1 scene 5
(obligations, verdicts, authorship), which the plan obligation joins as
a second kind.

What this scene does **not** show, and says so: one model, the
planning model, at pilot scale, as specification and checking only
(Shape 1), so a promise is admitted and never discharged; no second
model composed with this one, so nothing here is the cross-model ledger
of the rung's story; the language-model proposer runs on the
maintainer's subscription through Claude Code, so there is no public
demo of it, and its run is recorded once, not repeatable by a reader
without their own. Those are the rung's next scenes' questions, not this
scene's claims.
