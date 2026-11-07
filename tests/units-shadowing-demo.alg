// B-154 (unit-name shadowing) — shipped units resolve in the module first.
//
// A shipped unit is one lib/units.alg binds by name (m, km, cm, mm, s,
// min, minute, minutes, h, hour, hours, seconds, kg, g, N, J, W, Pa).
// Inside a quantity literal a shipped name always means the module's
// unit, whatever this file binds under the same name; any other name
// resolves in this file, so a file still defines its own units (U-R2).
// Ruling R2 (b) of docs/plans/pilot-findings.md.
use units

// The pilot's cycle, made small: the literal's `s` is the module's
// second, so `s = d.mag` no longer feeds itself.
d = 30 s
s = d.mag
print(s)                              // expect: 30
print(d.toString())                   // expect: 30 s

// A shipped name bound to a number: the literal still reads the unit.
local_int() =>
  s = 42
  t = 30 s
  t.toString()
print(local_int())                    // expect: 30 s

// A top-level binding of a shipped name: the same.
km = 42
k = 30 km
print(k.toString())                   // expect: 30 km
print(k.to(m).toString())             // expect: 30000 m

// A file-defined unit resolves in this file, as before.
furlong = Unit("furlong", length_dim, 201.168)
print((3 furlong).to(m).toString())   // expect: 603.504 m

// A shipped name rebound to another Unit: inside a literal the module's
// unit wins; by name, outside a literal, the file's binding is used.
h = Unit("hand", length_dim, 0.1016)
print((2 h).toString())               // expect: 2 h
print((2 h).to(minutes).toString())   // expect: 120 min
print(h.name)                         // expect: hand
print(qty(5, h).to(cm).toString())    // expect: 50.8 cm
