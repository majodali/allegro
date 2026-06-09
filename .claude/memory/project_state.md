---
name: allegro-project-state
description: Allegro narrative arc — foundation done, mid-flight in the provability arc; defer to CLAUDE.md for inventory
type: project
originSessionId: 5836184c-ea1b-474c-97be-8f52409678fd
---
Allegro is a programmable language platform: minimal base ("Allegretto") + extensible standard ("Allegro Standard") + top-tier app-developer language ("Allegro Vivace", future).

**Authoritative inventory** lives in `/home/matthew/projects/allegro/CLAUDE.md` — types, tests, file structure, syntax. Don't cite specific test counts or file lists from memory; they go stale.

## Narrative arc

**Foundation (done):**
- Base + Standard languages, type system, modules
- Parser evolution: Earley → hybrid Pratt+RD → grammar2 formalism (scannerless, stratified precedence, Warth-style left recursion)
- Runtime grammar extension Phases 1–7: `grammar { … }` blocks, `use NAME` activation, EBNF rule bodies, multi-token `expr_form` / `stmt_form`, `new grammar` / `grammar extends X`, hygienic templates, selector-based rule surgery
- Type system: 10 core types, generics, function-type unification, refinements (`Type && _ > 0`, `preserveOps`), interfaces (structural), mixins, Type.invariant, fluent type API

**Provability arc (in progress) — Allegro's defining feature:**
- A (done): introspection surface, `allegro inspect`, web Inspect button
- B (done): abstract domains, predicate implication, static discharge of refinements
- C1–C2 (done): predicate sets per binding, branch refinement, `assert`
- C3 (done): `requires` / `ensures` body-form contracts
- C4 (done): `Type.invariant` lifecycle invariants
- D1 (done): effect types as extensible flat labels; Slice 2 (done) — effects-as-component, HOF effect polymorphism, walker removal
- D2–D5 ahead: parametric capabilities, info flow, budgets, behavioral specs
- E (done): totality — all six stages (0 partial/exhaustiveness, 2 structural termination, 3 `decreases`, 4 mutual recursion via SCC, 5 HOF-mediated recursion, 6 counterexample rendering)
- F (mostly done): proof terms. F1 (Proof meta-type + proof_by_eval PE-as-discharge + theorem/verify base-grammar + checkProofs), F2 (proof_refines via impliesDomain), F3 (combinators refl/sym/trans/cong + `theorem … by <term>` soundness), F4 (lib/tactics.alg — same/flip/under/step/chain/rewrite + by_cases_bool/by_induction), F5 (prove_for_all_bool + prove_induction with bounded sample verification K=4), F7 (proven body-form clause — the [impl, proof] surface for Phase H, bounded sampling K=4 over the param type) all done. Only F6 (Lean export — long-term trust-chain piece) pending in the F arc. Plan in `.claude/plans/phase-f-plan.md`.
- G (pilot done): `lib/provable.alg` ships 6 utility functions with 23 named theorems checked at lib load time (F1 PE + F3 combinators + F5 universal-Bool). First lib that walks the F-arc talk. Full Array.map/filter/reduce + sort/search rewrites remain as Phase G expansion.
- H ahead: AI collaboration protocol ([impl, proof] pairs — F7 is the surface contract)
- I ahead: code generation (JS/WASM/native), informed by invariants and effects
- J ahead: review UX

## How to apply

- Read CLAUDE.md first for current state. Always run `npx tsc --noEmit` and `npx tsx src/test.ts` after changes.
- When asked "where are we?", answer in arc terms (e.g., "post-D1, working toward D1 chunk 2 then D2"), not test counts.
- The arc IS the project — every new feature should be evaluable against where it lands in this sequence.
