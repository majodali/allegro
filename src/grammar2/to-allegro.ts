// =============================================================================
// Allegro Grammar 2 — TS Grammar → Allegro Value bridge
//
// Converts a grammar2 Grammar (TS structure) into an Allegro Value tree so
// Allegro-native functions can analyze it. This is the first step of Phase 5:
// porting the analyzer to Allegro.
//
// Shape produced:
//
//   Grammar = Object {
//     productions: Object { "name" → Production },
//     start:       String,
//     reserved:    Object { "setName" → Array[String] },
//   }
//
//   Production = Object { name, rule, attrs }
//
//   Rule = Object { kind: String, ...kind-specific fields }
//     kind "terminal":  { kind, match: TerminalMatch }
//     kind "nonterm":   { kind, name: String }
//     kind "seq":       { kind, items: Array[Rule] }
//     kind "alt":       { kind, options: Array[Rule] }
//     kind "rep":       { kind, item: Rule, min: Int, max: Int | none, sep: Rule | none }
//     kind "opt":       { kind, item: Rule }
//     kind "guarded":   { kind, item: Rule, guard: Guard }
//
//   Guard = Object { kind, ... }
//     kind "notFollowedBy": { kind, rule: Rule }
//     kind "followedBy":    { kind, rule: Rule }
//     kind "reserved":      { kind, setName: String }
//
//   TerminalMatch = Object { kind, ... }
//     kind "literal":   { kind, text: String }
//     kind "charClass": { kind, pattern: String }
//     kind "regex":     { kind, pattern: String }
//     kind "eof":       { kind }
//     kind "empty":     { kind }
//     kind "fail":      { kind }
//     kind "indent":    { kind, directive: String }
// =============================================================================

import { Grammar, Rule, Production, Guard, TerminalMatch, Terminal } from "./types.js";
import { Value, makeInt, stringToBits } from "../types.js";
import { makeArray, makeObject } from "../types-std.js";
import { noneSingleton, withType, StringType, IntType } from "../types-std.js";

function str(s: string): Value {
  return withType(stringToBits(s), StringType);
}

function num(n: number): Value {
  return withType(makeInt(n), IntType);
}

function terminalMatchToAllegro(m: TerminalMatch): Value {
  switch (m.kind) {
    case "literal":   return makeObject([["kind", str("literal")],   ["text", str(m.text)]]);
    case "charClass": return makeObject([["kind", str("charClass")], ["pattern", str(m.pattern)]]);
    case "regex":     return makeObject([["kind", str("regex")],     ["pattern", str(m.pattern.source)]]);
    case "eof":       return makeObject([["kind", str("eof")]]);
    case "empty":     return makeObject([["kind", str("empty")]]);
    case "fail":      return makeObject([["kind", str("fail")]]);
    case "indent":    return makeObject([["kind", str("indent")], ["directive", str(m.directive)]]);
  }
}

function guardToAllegro(g: Guard): Value {
  switch (g.kind) {
    case "notFollowedBy":
      return makeObject([["kind", str("notFollowedBy")], ["rule", ruleToAllegro(g.rule)]]);
    case "followedBy":
      return makeObject([["kind", str("followedBy")],    ["rule", ruleToAllegro(g.rule)]]);
    case "reserved":
      return makeObject([["kind", str("reserved")],      ["setName", str(g.setName)]]);
  }
}

export function ruleToAllegro(rule: Rule): Value {
  switch (rule.kind) {
    case "terminal":
      return makeObject([
        ["kind",  str("terminal")],
        ["match", terminalMatchToAllegro(rule.match)],
      ]);
    case "nonterm":
      return makeObject([
        ["kind", str("nonterm")],
        ["name", str(rule.name)],
      ]);
    case "seq":
      return makeObject([
        ["kind",  str("seq")],
        ["items", makeArray(rule.items.map(ruleToAllegro))],
      ]);
    case "alt":
      return makeObject([
        ["kind",    str("alt")],
        ["options", makeArray(rule.options.map(ruleToAllegro))],
      ]);
    case "rep":
      return makeObject([
        ["kind", str("rep")],
        ["item", ruleToAllegro(rule.item)],
        ["min",  num(rule.min)],
        ["max",  rule.max === null ? noneSingleton : num(rule.max)],
        ["sep",  rule.sep ? ruleToAllegro(rule.sep) : noneSingleton],
      ]);
    case "opt":
      return makeObject([
        ["kind", str("opt")],
        ["item", ruleToAllegro(rule.item)],
      ]);
    case "guarded":
      return makeObject([
        ["kind",  str("guarded")],
        ["item",  ruleToAllegro(rule.item)],
        ["guard", guardToAllegro(rule.guard)],
      ]);
  }
}

function productionToAllegro(p: Production): Value {
  return makeObject([
    ["name", str(p.name)],
    ["rule", ruleToAllegro(p.rule)],
  ]);
}

export function grammarToAllegro(g: Grammar): Value {
  // Productions as Object { name → Production }
  const prodEntries: [string, Value][] = [];
  for (const [name, p] of g.productions) {
    prodEntries.push([name, productionToAllegro(p)]);
  }
  // Reserved as Object { setName → Array[String] }
  const reservedEntries: [string, Value][] = [];
  for (const [setName, entries] of g.reserved) {
    reservedEntries.push([setName, makeArray([...entries].map(str))]);
  }
  return makeObject([
    ["productions", makeObject(prodEntries)],
    ["start",       str(g.start)],
    ["reserved",    makeObject(reservedEntries)],
  ]);
}
