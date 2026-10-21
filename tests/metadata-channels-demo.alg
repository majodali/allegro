// Allegro Standard — metadata fields and writer capabilities
// The examples in docs/book/allegretto/metadata-and-capability.md.
// Registration mints the writer; reads are free; propagation follows the
// declared rule without the base knowing what the field means.

// --- A user field: register, write, read ---------------------------------

// `channel_register(name, rule)` returns the field's writer. The writer is
// the only way to put a value on the field.
audit = channel_register("audit", "union")
v = audit(42, "checked")

// Reads need no authority (D23).
print(channel_read(v, "audit"))
// expect: checked

// The field rides on the value; the value is still 42.
print(v)
// expect: 42

// A value that does not carry the field answers `none`.
print(channel_read(42, "audit"))
// expect: none

// `channel_list` names the fields a value carries. A plain typed literal
// carries only its `type`.
print(channel_list(42))
// expect: [type]

// --- Attenuation: a writer that writes less -----------------------------

// `channel_attenuate(writer, predicate)` wraps a held writer so that it
// writes only what the predicate admits. A rejected write halts.
ok_only = channel_attenuate(audit, x => x == "ok")
good = ok_only(5, "ok")
print(channel_read(good, "audit"))
// expect: ok

// --- Re-registration in the same pass returns the held writer ------------

// The evaluation loop may re-evaluate a top-level binding within one pass,
// so the same registration site gets its writer back. A later pass, or a
// different rule, is refused: the capability belongs to its first holder.
again = channel_register("audit", "union")
print(channel_read(again(1, "x"), "audit"))
// expect: x

// --- `viral`: present on any argument, present on the result --------------

// `error` is the base's own viral field. Every result derived from an
// error-carrying value carries the error, through primitives, through
// user functions and through a conditional's test.
e = make_error("boom")
print(channel_read((e + 1) * 2, "error"))
// expect: boom

sq = x => x * x
print(channel_read(sq(e), "error"))
// expect: boom

print(channel_read(if e then 1 else 2, "error"))
// expect: boom

// --- `drop`: never carried forward ---------------------------------------

// A `drop` field stays on the value it was written to. A value derived
// from it does not carry it: the derived value was not produced by
// whatever the field recorded.
note = channel_register("note", "drop")
n = note(7, 1)
print(channel_read(n, "note"))
// expect: 1

print(channel_read(n + 1, "note"))
// expect: none
