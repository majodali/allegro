# Prepared proposals for `tests/planning-loop-proposals.alg`

The scripted proposer's answers for the plan obligation of chunk L2's
demo, one fenced block per attempt, in the order the loop asks.

## `Fulfil: Shipped, which Depot needs`

First, freight: it ships what is packed, but too slowly for the budget.

```allegro
Freight:
  inputs: Packed
  outcomes: Shipped
  estimate: 90 min, 0.25 person-hours
```

Then a faster shipment, which fits.

```allegro
Ship:
  inputs: Packed
  outcomes: Shipped
  estimate: 45 min, 0.25 person-hours
```
