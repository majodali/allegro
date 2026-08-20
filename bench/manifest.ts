// PCP benchmark corpus manifest.
//
// A small graded-difficulty corpus of proof obligations, used to measure
// the provability arc across baselines (auto-PE, curated reference, LLM
// worker). Each entry is a self-contained `.alg` file under
// `bench/corpus/` in *solved* form — it verifies as-is. The harness
// derives the other measurement forms mechanically:
//
//   - **bare form** (auto-PE baseline) — strip the goal's `by` term and
//     ask whether the kernel discharges the proposition with no prover
//     at all. Measures the F-arc's free coverage.
//   - **gated form** (prover baseline) — replace the goal's `by` term
//     with a deliberately-wrong sentinel so `proof_check` rejects it,
//     turning the goal into a genuine pending obligation. A prover (the
//     LLM worker, or the curated reference term) must supply a correct
//     term to discharge it.
//
// Entries whose goal has no `by` slot (`referenceProof: null`) are
// auto-PE-only: their proposition is Proof-valued (e.g. `proof_refines`,
// `prove_for_all_bool`) and discharges directly. They have no soundness
// gate and are skipped by the prover baselines.

/** Coarse difficulty/skill categories, mirroring the Phase H plan's
 *  corpus shape (`docs/plans/phase-h-plan.md`). */
export type BenchCategory =
  | "refl-trivial"   // PE folds; the only proof is reflexivity
  | "combinator"     // needs sym / trans / cong composition over lemmas
  | "type-bound";    // refinement-domain / finite-domain quantification

export interface BenchEntry {
  /** Stable identifier, also the file stem prefix. */
  id: string;
  /** Path to the solved-form corpus file, relative to the repo root. */
  file: string;
  /** Difficulty / skill category. */
  category: BenchCategory;
  /** The theorem the baselines target. Every corpus file names its
   *  target `goal`; lemmas use other names. */
  goalTheorem: string;
  /** One-line description of the proof skill exercised. */
  description: string;
  /** The curated correct proof term for the goal's `by` slot, or null
   *  when the goal has no `by` slot (auto-PE-only entry). */
  referenceProof: string | null;
  /** Whether auto-PE is expected to discharge the BARE proposition (no
   *  proof term). True across this corpus — PE-as-discharge is total
   *  over closed propositions — but kept explicit so a future
   *  genuinely-residual obligation can record `false`. */
  autoPEBareExpected: boolean;
}

export const CORPUS: BenchEntry[] = [
  {
    id: "t01",
    file: "bench/corpus/t01-refl-const.alg",
    category: "refl-trivial",
    goalTheorem: "goal",
    description: "syntactic identity 7 == 7; reflexivity",
    referenceProof: "proof_refl(7)",
    autoPEBareExpected: true,
  },
  {
    id: "t02",
    file: "bench/corpus/t02-refl-arith.alg",
    category: "refl-trivial",
    goalTheorem: "goal",
    description: "arithmetic identity 2 + 2 == 4; reflexivity over a folded term",
    referenceProof: "proof_refl(2 + 2)",
    autoPEBareExpected: true,
  },
  {
    id: "t03",
    file: "bench/corpus/t03-refl-fncall.alg",
    category: "refl-trivial",
    goalTheorem: "goal",
    description: "identity through a function call sq(5) == 25; reflexivity",
    referenceProof: "proof_refl(sq(5))",
    autoPEBareExpected: true,
  },
  {
    id: "t04",
    file: "bench/corpus/t04-sym.alg",
    category: "combinator",
    goalTheorem: "goal",
    description: "symmetry: flip an in-scope equality lemma",
    referenceProof: "proof_sym(ab)",
    autoPEBareExpected: true,
  },
  {
    id: "t05",
    file: "bench/corpus/t05-trans.alg",
    category: "combinator",
    goalTheorem: "goal",
    description: "transitivity: compose two lemmas through a shared middle term",
    referenceProof: "proof_trans(ab, bc)",
    autoPEBareExpected: true,
  },
  {
    id: "t06",
    file: "bench/corpus/t06-trans-chain.alg",
    category: "combinator",
    goalTheorem: "goal",
    description: "3-link transitivity chain; nested proof_trans (tactics.chain shape)",
    referenceProof: "proof_trans(e1, proof_trans(e2, e3))",
    autoPEBareExpected: true,
  },
  {
    id: "t07",
    file: "bench/corpus/t07-cong.alg",
    category: "combinator",
    goalTheorem: "goal",
    description: "congruence: lift an equality through a function",
    referenceProof: "proof_cong(triple, t3)",
    autoPEBareExpected: true,
  },
  {
    id: "t08",
    file: "bench/corpus/t08-rewrite.alg",
    category: "combinator",
    goalTheorem: "goal",
    description: "rewrite: cong + sym + trans composition (tactics.rewrite shape)",
    referenceProof: "proof_trans(proof_cong(inc, proof_sym(ab2)), fac)",
    autoPEBareExpected: true,
  },
  {
    id: "t09",
    file: "bench/corpus/t09-refines.alg",
    category: "type-bound",
    goalTheorem: "goal",
    description: "refinement-domain entailment; auto-PE only (no by slot)",
    referenceProof: null,
    autoPEBareExpected: true,
  },
  {
    id: "t10",
    file: "bench/corpus/t10-forall-bool.alg",
    category: "type-bound",
    goalTheorem: "goal",
    description: "universal quantification over Bool; auto-PE only (no by slot)",
    referenceProof: null,
    autoPEBareExpected: true,
  },
];

/** A proof term that is syntactically valid but proves a fact unrelated
 *  to any corpus goal (it establishes `987654321 == 987654321`). Spliced
 *  into a goal's `by` slot, `proof_check` rejects it, producing the
 *  pending "gated" obligation the prover baselines must solve. */
export const WRONG_SENTINEL_TERM = "proof_refl(987654321)";
