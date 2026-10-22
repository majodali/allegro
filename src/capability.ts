// =============================================================================
// Writer capabilities — the `capability` unit (docs/book/units.md §4.1 row
// 11; split out of slots.ts at B-112 C1, 2026-10).
//
// Authority is a capability, not a name (R12). Registering a field is
// one-shot and RETURNS the field's write operation as a closure (D24: the
// capability IS the closure — delegable, attenuable, unconstructible from
// Allegretto). Reads are free (D23). Integrity fields may only register
// non-fabricating propagation rules (`drop` / `computed`) — `viral`/`union`
// on an authority field is forgery vector C. Anything INSTALLED into the
// base is gated the same way (P4, docs/plans/plane-interfaces.md §5.4):
// the installer proves ownership by holding the field's writer.
//
// Depends on `src/metadata.ts` (the table it mints into) and the
// binding-plane accessor surface. Nothing below the base imports it.
// =============================================================================

import {
  Value,
  ValueKind,
  AllegroError,
  withMeta,
  StructureValue,
} from "./types.js";
import {
  MetaFieldSpec, MetaFieldWriter, FieldCheck, DispatchInstall, Projection, defineMetaField, metaFieldEntry, metaFieldEntries,
  currentMetaEpoch, cloneMeta, defineFieldMerge, defineFieldCheck, defineDispatch, defineProjection,
} from "./metadata.js";
import { stampBindingSlot } from "./slot-accessors.js";

export type { MetaFieldSpec, MetaFieldWriter, FieldCheck, FieldReader, CheckSite, DispatchInstall, CallSite, CallBinding, Projection } from "./metadata.js";

function buildWriter(spec: MetaFieldSpec): MetaFieldWriter {
  return {
    channel: spec.name,
    write(target: Value, fieldValue: Value): Value {
      if (spec.bindingKey) {
        if (target.kind !== ValueKind.Structure) {
          throw new AllegroError(`channel '${spec.name}': binding-plane write target must be a Context`);
        }
        stampBindingSlot(target as StructureValue, spec.bindingKey, fieldValue);
        return target;
      }
      const comps = cloneMeta(target);
      comps.set(spec.name, fieldValue);
      // withMeta handles every kind: a Structure derives, a leaf is cloned
      // with the field attached (B-121).
      return withMeta(target, comps) as Value;
    },
  };
}

/** One-shot field registration → writer capability. Throws on duplicate
 *  names (re-registration is forgery vector F) and on fabricating rules for
 *  integrity fields (forgery vector C). */
export function registerMetaField(spec: MetaFieldSpec, minted = false): MetaFieldWriter {
  const existing = metaFieldEntry(spec.name);
  if (existing) {
    // Same-pass re-evaluation of the SAME Allegro registration site: hand
    // back the held writer. Anything else is forgery vector F.
    if (existing.minted && minted && existing.epoch === currentMetaEpoch() && existing.spec.rule === spec.rule) {
      return existing.writer;
    }
    throw new AllegroError(`channel '${spec.name}' is already registered — the writer capability is held by its owner`);
  }
  if (spec.integrity && (spec.rule === "viral" || spec.rule === "union")) {
    throw new AllegroError(`channel '${spec.name}': integrity channels may not register fabricating propagation rules (viral/union) — D23`);
  }
  const writer = buildWriter(spec);
  defineMetaField({ spec, writer, epoch: minted ? currentMetaEpoch() : -1, minted });
  return writer;
}

/** TS-kernel writer acquisition. Discipline is the boundary lint: call sites
 *  outside the kernel modules (types-std.ts, primitives.ts) fail the suite.
 *  The writer is never exposed to Allegro — extension bindings do not
 *  include it, and Allegretto cannot construct a host closure (D24). */
export function kernelFieldWriter(name: string): MetaFieldWriter {
  const e = metaFieldEntry(name);
  if (!e) throw new AllegroError(`no such channel: '${name}'`);
  return e.writer;
}

/** Does `writer` hold the authority for `name`? Identity against the table:
 *  a structurally similar object is not the capability (D24). */
function holdsWriterFor(writer: MetaFieldWriter, name: string): boolean {
  const e = metaFieldEntry(name);
  return e !== undefined && e.writer === writer;
}

/** Install the `union` merge for a field. GATED (P4, B-112 C1): the caller
 *  proves ownership with the field's writer; any module could install a
 *  merge before, and so any module could decide what merging `effects`
 *  meant. The merge itself is the owner's meaning; the base holds the
 *  symbol (`metadata.ts` `fieldMerge`) and the evaluator reads it by name. */
export function installFieldMerge(writer: MetaFieldWriter, merge: (a: Value, b: Value) => Value): void {
  if (!holdsWriterFor(writer, writer.channel)) {
    throw new AllegroError(`installFieldMerge: the merge for '${writer.channel}' may be installed only by the holder of its writer (P4)`);
  }
  defineFieldMerge(writer.channel, merge);
}

/** Install the check for a field (B-112 C2, hook (b)): how an argument is
 *  checked against a declared constraint that names this field. GATED the
 *  same way as the merge (P4): the installer holds the writer, or any
 *  module could decide what type checking means. The base runs every
 *  installed check at a typed call site and knows none of their meanings. */
export function installFieldCheck(writer: MetaFieldWriter, check: FieldCheck): void {
  if (!holdsWriterFor(writer, writer.channel)) {
    throw new AllegroError(`installFieldCheck: the check for '${writer.channel}' may be installed only by the holder of its writer (P4)`);
  }
  defineFieldCheck(writer.channel, check);
}

/** Install how the evaluator dispatches on a field (B-112 C3, hook (a)):
 *  operator and equality dispatch at primitive application, and the
 *  binding of a callee's declared constraints at a composed call. GATED
 *  (P4) like the merge and the check. */
export function installDispatch(writer: MetaFieldWriter, d: DispatchInstall): void {
  if (!holdsWriterFor(writer, writer.channel)) {
    throw new AllegroError(`installDispatch: dispatch on '${writer.channel}' may be installed only by the holder of its writer (P4)`);
  }
  defineDispatch(writer.channel, d);
}

/** Install a projection (B-112 C4, hook (c)): how the field named by the
 *  writer is COMPUTED on read when nothing stores it. A projection reads as
 *  a field, so installing one is writing that field's meaning — GATED (P4)
 *  on the field's own writer. The base serves it by name from
 *  `metaReadRaw` and knows nothing of what it computes from. */
export function installProjection(writer: MetaFieldWriter, project: Projection): void {
  if (!holdsWriterFor(writer, writer.channel)) {
    throw new AllegroError(`installProjection: the projection '${writer.channel}' may be installed only by the holder of its writer (P4)`);
  }
  defineProjection(writer.channel, project);
}

// --- Field registration: what the BASE owns ------------------------------------
//
// B-109(a) / concept-campaign C3 (2026-08). The base used to register eleven
// fields at module init, including the layers' own. R6/R11 say the base owns
// the MECHANISM and each layer owns ITS fields — so a field survives here only
// if the base concept it serves survives in Allegretto.
//
// That test was run rather than argued: `make_error("boom")` and `source of x`
// both work under `--base`, so `error` and `source` are Allegretto's own and
// stay. The six L2 fields moved to their owners:
//
//   shape, type   → src/types-std.ts    (the type system)
//   effects       → src/effects.ts      (the effects extension)
//   predicates,
//   domain, bound → src/refinements.ts  (refinement knowledge)
//   discharged    → src/proofs.ts       (the proof kernel)
//
// Three have NO owner to move to, and each is a B-111 finding rather than a
// relocation: `knowledge` is a capability whose storage is other fields and
// which nothing ever writes; `warnings` is registered `union` and unused
// (B-117 intends to reach for it when the verdict accumulates); `exported`
// was retired at B-097 V1 when visibility became a property of the Binding.
// They stay registered here, wrongly, until B-111 says what they are.

// D47 (B-094): drop — a derived value was not produced by the recorded
// expression, so propagating source would fabricate provenance. Kernel-
// originated (evaluator attachment only); reads via `source of` are
// observe-tagged (§3.1). Integrity added at B-109(c) — it had been in the old
// hardcoded name list while registered WITHOUT the flag, two sources of truth
// disagreeing about one field.
registerMetaField({ name: "source", rule: "drop", integrity: true });
registerMetaField({ name: "error", rule: "viral" });

// --- Fields with no owner yet (B-111) ------------------------------------------
// C3.1 (D36): `knowledge` is the canonical knowledge lattice — but nothing
// ever stores a `knowledge` value. Its physical storage IS `predicates` /
// `domain` plus the refinement layers of the stored type, and it is read
// through refinements.ts `knowledgeOf`. A capability, not a field.
registerMetaField({ name: "knowledge", rule: "computed" });
// Registered `union` — precisely the accumulating discipline the verdict
// needs — and never written. B-117.
registerMetaField({ name: "warnings", rule: "union" });
// Retired at B-097 V1 (D42/V-R4): visibility became a property of the BINDING,
// never of the value. The registration outlived the concept.
registerMetaField({ name: "exported", rule: "drop" });

/**
 * Gate for user-reachable construction paths: throws if the key would
 * originate an integrity field without holding its writer.
 *
 * B-109(b)(c) (2026-08): authority is read from the REGISTRY rather than
 * from a hardcoded name list. The old list was a second source of truth and
 * the two disagreed — `source` was in the list but registered WITHOUT
 * `integrity: true`.
 *
 * It also checked BARE FIELD NAMES, which conflated two planes. An object
 * literal writes the BINDING plane; it cannot originate a metadata field at
 * all — `{type: "widget"}` gives the record a `type` slot while `type of` it
 * still answers `Object`. So the bare-name check defended nothing and cost
 * users the field names `discharged` and `source`. What it must still refuse
 * is a binding-plane key that a field uses as its STORAGE (`__discharged`),
 * which is a real origination path, and those come from the registry too.
 */
function integrityBindingKeys(): Set<string> {
  const keys = new Set<string>();
  for (const entry of metaFieldEntries()) {
    if (entry.spec.integrity && entry.spec.bindingKey) keys.add(entry.spec.bindingKey);
  }
  return keys;
}

export function assertNotIntegrityKey(key: string, site: string): void {
  if (integrityBindingKeys().has(key)) {
    throw new AllegroError(
      `${site}: cannot originate integrity channel '${key.replace(/^__/, "")}' — origination requires the channel writer (D21–D24)`
    );
  }
}

/** Brand for Allegro-level channel-writer PrimitiveFunctions (host-internal
 *  js-property; registered in SLOT_REGISTRY). Attenuation checks it. */
export const FIELD_WRITER_BRAND = "channelWriterFor";
