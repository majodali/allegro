# Language layers, capability tracks & milestones

> Tier 1 design doc. The architectural spine: the layer model with one-way
> dependencies, the cross-cutting capability tracks, and the milestone
> register. Every backlog item carries a layer/track tag defined here; each
> layer's **boundary contract** lives in its `docs/design/<layer>/README.md`.
> Maintainer rulings 2026-07 (parser placement, module split, provability
> clustering, build-pipeline-as-track) are incorporated.

## 1. The layer spine

Four layers with **strict one-way dependencies** — each layer may depend
only on layers below it, never above, never sideways into a track's
internals. The boundary contracts are enforced by the boundary-test
harness (`structures-implementation` Phase 0).

| Layer | Name | Contents (summary) | Depends on |
|---|---|---|---|
| **L0** | **Allegretto** | Value kinds, expression DAGs, evaluator, partial-evaluation rules, forward-chaining/futures; post-rewrite: structures, scopes, channels, the ~40 base primitives. No types, no proofs, no concrete syntax. | Host only |
| **L1** | **Extension substrate** | What makes the platform programmable: grammar formalism + engine, runtime grammar extension, extension/module **loading**, and the standard **parser** (concrete syntax is an extension — see ruling below). | L0 |
| **L2** | **Allegro Standard** | The type system, core types + collections, **typed module objects** and encapsulation, the standard library, and the **provability capability** (see §3) — all expressed as L1 extensions over L0. | L0, L1 |
| **L3** | **Allegro Vivace** | Domain DSLs and the model-driven layer; the pilot projects; eventually a parser generator capable of re-hosting the L1 standard parser. | L0–L2 |

**Rulings that pin the boundaries (2026-07):**

- **Parser (L1).** Concrete syntax is an extension. The standard parser is
  L1 — and may eventually be re-defined at L3 using Vivace's parser
  generator. The parser used to bootstrap L0 is *external to L0 itself*:
  it belongs in L1, but prior to a formal extension substrate it may exist
  without one. L0's own definition is syntax-free.
- **Module system (split).** The loading mechanism — extensions, dependency
  resolution, caching — is L1. Typed module objects, export surfaces, and
  encapsulation are L2. (V1 was already subtly split on these lines; the
  split is now the contract.)
- **Provability (L2 capability).** Provability is an independent capability
  cluster *within* L2 — architecturally "just more extensions," but it is
  the differentiating thesis and carries its own milestone, docs, and
  backlog band. "Standard complete" and "provability complete" are
  separate states.
- **Build pipeline (track).** The multi-phase build/execution pipeline is
  not a layer: it is an explicit **track** with capabilities at each layer
  (L0: PE phases + phase-gate semantics; L1: extension pre-loading, `use`
  scanning; L2: typed configuration surfaces; L3: domain build steps).

## 2. Capability tracks

Tracks are cross-cutting deliverables. Each declares which layers it
touches; a track may consume any layer's public surface but is never a
dependency *of* a layer.

| Track | Touches | What it is |
|---|---|---|
| **T-build** | L0–L3 | Multi-phase build/execution pipeline (invocation → config → compile → emit → package → deploy → execute); phase gates; project configuration |
| **T-tooling** | L0, L2 | Tracing, debugging, introspection (`inspect`), review UX; enriched by L2 knowledge |
| **T-host** | L0, L2 | Execution environments: Node CLI, browser sandbox, env-provided capabilities (`print`/`fetch`/`delay`), async I/O |
| **T-backend** | L0, L2 | Target code generation (JS/WASM/native) over the L0 expression graph, provability-informed optimization |
| **T-perf** | all | Performance: memoization-as-feature, continuation TCO, parser constants, representation payoffs |
| **T-bootstrap** | L1–L2 | Self-hosting closure: L1/L2 machinery re-expressed in Allegro; depends on Standard + T-backend |
| **T-ecosystem** | L2 | Packages, versioning, dependency resolution, registry |

## 3. Milestones

Named completion states, each pinned to a layer or track, each tagged
**validated** (design exists and is signed) or **aspirational** (validate
any time before implementation). Finalizing a milestone requires at
minimum a design doc (or folder) under `docs/design/`.

| ID | Milestone | Layer/track | Status | Design home |
|---|---|---|---|---|
| M1 | **Allegretto v2 complete** — the structures rewrite lands (structures/scopes/channels, minimal base surface, boundary harness green) | L0 | **validated** (design signed; impl plan drafted) | `allegretto/` |
| M2 | **Extension substrate formalized** — parser-as-extension explicit, module loading contract, grammar extension revalidated on v2 substrate | L1 | validated (design mostly shipped in v1; revalidation scoped) | `extension/` |
| M3 | **Standard revalidated on v2** — type system, core types, collections, typed modules re-derived through channels/kinds; v1 feature inventory dispositioned | L2 | **validated** (structures.md is the design) | `standard/` |
| M4 | **Provability capability complete** — contracts, totality, proofs, effects, PCP end-to-end on the v2 substrate; kernel as single trust boundary | L2 (capability) | validated thesis; component designs **revalidation-gated** (BACKLOG register) | `standard/` (proofs, pcp, contracts, totality) |
| M5 | **First Vivace pilot shipped** — planning DSL through its full arc (model → DSL → provable plans) | L3 | aspirational (v1 design revalidation-gated) | `vivace/` |
| M6 | **Build pipeline end-to-end** — multi-phase PE build works across a real project | T-build | aspirational | `platform/` |
| M7 | **Tracing & debugging usable** — execution tracing, graph inspection, step-through | T-tooling | aspirational | `platform/` |
| M8 | **Target code generation** — expression graph → JS first | T-backend | aspirational (Phase I revalidation-gated) | `platform/` |
| M9 | **Self-hosted parser + type system** | T-bootstrap | aspirational | `platform/` |
| M10 | **Package ecosystem** | T-ecosystem | aspirational | `platform/` |

**Mapping from the old BACKLOG milestones:** "Allegro Standard complete" →
M3+M4 (split per ruling 3). "DSL ready" → M2 (mechanism; largely shipped
in v1, revalidate) + M5 (first real domain use). "Multi-phase build
pipeline" → M6. "Tracing and debugging" → M7. "Standard library" → folded
into M3 (core) with growth ongoing. "Fully bootstrapped" → M9. "In-browser
sandbox" → T-host (continuous; already live at allegrolang.org — not a
milestone). "Target code generation" → M8. "Performance optimization" →
T-perf (continuous track, not a milestone). "Package ecosystem" → M10.
**New:** M1 (Allegretto — was missing entirely) and M5 (Vivace — was
missing despite being the vision's endpoint).

## 4. How the backlog uses this

Every `docs/backlog.md` item carries a stable ID (`B-###`) and a layer/track
tag from this doc. The list head is sequenced (implementation order); the
tail is banded by layer/track in spine order, marked "not yet sequenced."
Layer boundary questions that arise during implementation are settled as
deltas to the layer README (boundary contract) — never ad hoc in code.
