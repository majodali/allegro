# Review record: the evaluator chapter, rendered from its IR

Text reviewed: `docs/book/allegretto/evaluator.md`, normative text
rendered by the reasoning role from `docs/book/allegretto/evaluator.ir.md`
(134 claims in 32 clusters, 30 terms of which 1 proposed, 9 relations,
41 evidence pointers). Reader of the reviewed text: RD-4 (a fresh agent
session). Reviewer: a stranger, a fresh stranger instance (a smaller
model, dispatched per round) with no conversation context, reading only
the prose, the IR and its brief. Rounds until readable, limit ten (the
methodology's IR specification, Stranger rounds; plan
`docs/plans/book-chapters-now.md` §3.1). Every fix is made in the IR
first; the prose is then re-rendered or edited to match, and the render
map updated.

Lint before round 1: `npm run lint:ir` clean (CK-01 to CK-14 and CK-16;
unratified terms 1); round trip 134 of 134 claims in the render map;
`npm run lint:docs:check` gate passed (anchors 0, order 0, ids 791 at or
below the baseline of 796).

The brief, in short: the stranger reads the prose first and writes a
restatement of the chapter's problem, terms and decisions before opening
the IR. It then compares the restatement with the IR and reports each
finding with its kind (restatement mismatch, contradiction, undefined
term, referent, compound sentence, excess words), the fix kind it needs
(cut, rephrase, add) and its locus (prose, IR, both). The verdict is
readable when the restatement has no mismatch with the IR that counts,
and the stranger finds no contradiction and no undefined term.

## Curve

| Round | Prose words | IR claims | Findings | Per 1,000 words | Verdict |
|---|---|---|---|---|---|
