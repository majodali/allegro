// Allegro-native grammar static analyzer (Phase 5 — minimal port).
//
// Ported from src/grammar2/analyzer.ts. This is a proof-of-concept port of
// the simplest checks (defined-ness, reachability, nullability). Performance
// is dominated by the interpreter; full port awaits the emitter (Phase 9).
//
// Exports:
//   check_defined(grammar)    — returns list of E_UNDEFINED_NAME errors
//   check_reachable(grammar)  — returns list of W_UNREACHABLE warnings
//   compute_nullability(grammar) — returns list of nullable production names
//
// Grammar shape — see src/grammar2/to-allegro.ts for the TS → Allegro bridge.

// --- Helpers ---

contains(arr, v) => if arr.length == 0 then false else if arr[0] == v then true else contains(arr.slice(1), v)

add_unique(arr, v) => if contains(arr, v) then arr else arr.concat([v])

// --- Defined-ness: every nonterm reference resolves to a production ---

check_defined(grammar) => collect_undef(grammar.productions, grammar.productions.keys(), [])

collect_undef(prods, names, errs) =>
  if names.length == 0
    then errs
    else collect_undef(prods, names.slice(1), walk_defs(prods.get(names[0]).rule, names[0], prods.keys(), errs))

walk_defs(rule, prod_name, known, errs) => when rule.kind
  is "nonterm" then if contains(known, rule.name) then errs else errs.concat([{code: "E_UNDEFINED_NAME", message: "undefined name: " + rule.name, production: prod_name}])
  is "seq"     then fold_items(rule.items, prod_name, known, errs)
  is "alt"     then fold_items(rule.options, prod_name, known, errs)
  is "rep"     then if rule.sep == none then walk_defs(rule.item, prod_name, known, errs) else walk_defs(rule.sep, prod_name, known, walk_defs(rule.item, prod_name, known, errs))
  is "opt"     then walk_defs(rule.item, prod_name, known, errs)
  is "guarded" then walk_defs(rule.item, prod_name, known, errs)
  is _ then errs

fold_items(items, prod_name, known, errs) =>
  if items.length == 0 then errs else fold_items(items.slice(1), prod_name, known, walk_defs(items[0], prod_name, known, errs))

// --- Reachability ---

check_reachable(grammar) => unreachable_warnings(grammar, grammar.productions.keys(), find_reachable(grammar))

find_reachable(grammar) => reach_step(grammar.productions, [grammar.start], [grammar.start])

reach_step(prods, frontier, visited) =>
  if frontier.length == 0
    then visited
    else reach_step(prods, frontier.slice(1).concat(new_refs(prods, frontier[0], visited)), visited.concat(new_refs(prods, frontier[0], visited)))

new_refs(prods, name, visited) =>
  if prods.has(name) == false
    then []
    else filter_unseen(collect_nt(prods.get(name).rule, []), visited)

filter_unseen(refs, visited) =>
  if refs.length == 0 then [] else if contains(visited, refs[0]) then filter_unseen(refs.slice(1), visited) else [refs[0]].concat(filter_unseen(refs.slice(1), visited))

collect_nt(rule, acc) => when rule.kind
  is "nonterm" then add_unique(acc, rule.name)
  is "seq"     then fold_collect(rule.items, acc)
  is "alt"     then fold_collect(rule.options, acc)
  is "rep"     then if rule.sep == none then collect_nt(rule.item, acc) else collect_nt(rule.sep, collect_nt(rule.item, acc))
  is "opt"     then collect_nt(rule.item, acc)
  is "guarded" then collect_nt(rule.item, acc)
  is _ then acc

fold_collect(items, acc) =>
  if items.length == 0 then acc else fold_collect(items.slice(1), collect_nt(items[0], acc))

unreachable_warnings(grammar, all_names, reachable) =>
  if all_names.length == 0
    then []
    else if contains(reachable, all_names[0])
      then unreachable_warnings(grammar, all_names.slice(1), reachable)
      else [{code: "W_UNREACHABLE", message: "unreachable: " + all_names[0], production: all_names[0]}].concat(unreachable_warnings(grammar, all_names.slice(1), reachable))
