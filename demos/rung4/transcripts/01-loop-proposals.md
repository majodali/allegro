# Prepared proposals for `demos/rung4/01-loop.alg`

The scripted proposer's answers for the scene's plan obligation, one
fenced block per attempt, in the order the loop asks. `allegro prove
demos/rung4/01-loop.alg --proposals demos/rung4/transcripts/01-loop-proposals.md`
reads them; the walkthrough, `demos/rung4/01-loop.md`, shows the run.

## `Fulfil: Shipped, which Depot needs`

First, a messenger: it ships an order, but only a labelled one, and
nothing in the plan or the catalog labels it.

```allegro
Messenger:
  inputs: Labelled
  outcomes: Shipped
  estimate: 40 min, 0.25 person-hours
```

Then a dispatch of the packed order, which closes the gap within the
budget.

```allegro
Dispatch:
  inputs: Packed
  outcomes: Shipped
  estimate: 45 min, 0.25 person-hours
```
