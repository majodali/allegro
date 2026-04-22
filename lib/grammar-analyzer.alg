// Allegro-native grammar static analyzer.
//
// Ported from src/grammar2/analyzer.ts per Phase 5 of the grammar overhaul.
// Implements all Phase 0 §7 required checks except FIRST set computation
// (which depends on finer-grained character-class analysis and is deferred
// to a later pass — the analyzer only warns on alt-disjointness via FIRST
// overlap, and that check is off by default in our stratified grammar).
//
// Exports:
//   analyze(grammar) → full report { errors, warnings, nullable, leftRec }
//   check_defined(grammar)       → errors[]
//   check_reachable(grammar)     → warnings[]
//   compute_nullability(grammar) → [name, ...]
//   check_infinite_rep(grammar, nullable) → errors[]
//   check_reservations(grammar)  → errors[]
//   check_left_recursion(grammar, nullable) → [name, ...]
//
// Grammar shape — see src/grammar2/to-allegro.ts for the TS → Allegro bridge.

// =============================================================================
// List helpers
// =============================================================================

contains(arr, v) =>
  if arr.length == 0
    then false
    else if arr[0] == v then true else contains(arr.slice(1), v)

add_unique(arr, v) =>
  if contains(arr, v) then arr else arr.concat([v])

concat_all(lists) =>
  if lists.length == 0 then [] else lists[0].concat(concat_all(lists.slice(1)))

// =============================================================================
// Defined-ness — every nonterm reference resolves to a production.
// =============================================================================

check_defined(grammar) =>
  names = grammar.productions.keys()
  base = collect_undef(grammar.productions, names, [])
  if grammar.productions.has(grammar.start)
    then base
    else base.concat([{
      code: "E_UNDEFINED_START",
      message: "start production is not defined: " + grammar.start,
      production: none,
    }])

collect_undef(prods, names, errs) =>
  if names.length == 0
    then errs
    else collect_undef(prods, names.slice(1),
      walk_defs(prods.get(names[0]).rule, names[0], prods.keys(), errs))

walk_defs(rule, prod_name, known, errs) => when rule.kind
  is "nonterm" then
    if contains(known, rule.name)
      then errs
      else errs.concat([{code: "E_UNDEFINED_NAME", message: "production '" + rule.name + "' is referenced but not defined", production: prod_name}])
  is "seq"     then fold_defs(rule.items,   prod_name, known, errs)
  is "alt"     then fold_defs(rule.options, prod_name, known, errs)
  is "rep"     then
    if rule.sep == none
      then walk_defs(rule.item, prod_name, known, errs)
      else walk_defs(rule.sep, prod_name, known, walk_defs(rule.item, prod_name, known, errs))
  is "opt"     then walk_defs(rule.item, prod_name, known, errs)
  is "guarded" then walk_defs(rule.item, prod_name, known, errs)
  is _         then errs

fold_defs(items, prod_name, known, errs) =>
  if items.length == 0
    then errs
    else fold_defs(items.slice(1), prod_name, known,
      walk_defs(items[0], prod_name, known, errs))

// =============================================================================
// Reachability — warn about productions not reachable from start.
// =============================================================================

check_reachable(grammar) =>
  if grammar.productions.has(grammar.start) == false
    then []
    else unreachable_warnings(grammar.productions.keys(),
      reach_step(grammar.productions, [grammar.start], [grammar.start]))

reach_step(prods, frontier, visited) =>
  if frontier.length == 0
    then visited
    else reach_step(prods, frontier.slice(1).concat(new_refs(prods, frontier[0], visited)),
      visited.concat(new_refs(prods, frontier[0], visited)))

new_refs(prods, name, visited) =>
  if prods.has(name) == false
    then []
    else filter_unseen(collect_nt(prods.get(name).rule, []), visited)

filter_unseen(refs, visited) =>
  if refs.length == 0
    then []
    else if contains(visited, refs[0])
      then filter_unseen(refs.slice(1), visited)
      else [refs[0]].concat(filter_unseen(refs.slice(1), visited))

collect_nt(rule, acc) => when rule.kind
  is "nonterm" then add_unique(acc, rule.name)
  is "seq"     then fold_collect(rule.items,   acc)
  is "alt"     then fold_collect(rule.options, acc)
  is "rep"     then
    if rule.sep == none
      then collect_nt(rule.item, acc)
      else collect_nt(rule.sep, collect_nt(rule.item, acc))
  is "opt"     then collect_nt(rule.item, acc)
  is "guarded" then collect_nt(rule.item, acc)
  is _ then acc

fold_collect(items, acc) =>
  if items.length == 0
    then acc
    else fold_collect(items.slice(1), collect_nt(items[0], acc))

unreachable_warnings(all_names, reachable) =>
  if all_names.length == 0
    then []
    else if contains(reachable, all_names[0])
      then unreachable_warnings(all_names.slice(1), reachable)
      else [{code: "W_UNREACHABLE", message: "unreachable: " + all_names[0], production: all_names[0]}].concat(unreachable_warnings(all_names.slice(1), reachable))

// =============================================================================
// Nullability (fixed-point)
// =============================================================================

compute_nullability(grammar) =>
  iterate_nullability(grammar.productions, grammar.productions.keys(), [])

iterate_nullability(prods, names, nullable) =>
  next_set = extend_nullable(prods, names, nullable, nullable)
  if next_set.length == nullable.length
    then nullable
    else iterate_nullability(prods, names, next_set)

extend_nullable(prods, names, check, nullable) =>
  if names.length == 0
    then nullable
    else if contains(nullable, names[0])
      then extend_nullable(prods, names.slice(1), check, nullable)
      else if is_nullable(prods.get(names[0]).rule, check)
        then extend_nullable(prods, names.slice(1), check, add_unique(nullable, names[0]))
        else extend_nullable(prods, names.slice(1), check, nullable)

is_nullable(rule, nullable) => when rule.kind
  is "terminal" then
    if rule.match.kind == "empty"
      then true
      else if rule.match.kind == "indent"
        and (rule.match.directive == "INDENT" or rule.match.directive == "DEDENT" or rule.match.directive == "SAMELINE")
        then true
        else false
  is "nonterm" then contains(nullable, rule.name)
  is "seq"     then all_nullable(rule.items,   nullable)
  is "alt"     then any_nullable(rule.options, nullable)
  is "rep"     then rule.min == 0 or is_nullable(rule.item, nullable)
  is "opt"     then true
  is "guarded" then is_nullable(rule.item, nullable)
  is _         then false

all_nullable(items, nullable) =>
  if items.length == 0
    then true
    else if is_nullable(items[0], nullable)
      then all_nullable(items.slice(1), nullable)
      else false

any_nullable(items, nullable) =>
  if items.length == 0
    then false
    else if is_nullable(items[0], nullable)
      then true
      else any_nullable(items.slice(1), nullable)

// =============================================================================
// Infinite-Rep — Rep of a nullable item with no non-nullable separator.
// =============================================================================

check_infinite_rep(grammar, nullable) =>
  fold_prods_rep(grammar.productions.keys(), grammar.productions, nullable, [])

fold_prods_rep(names, prods, nullable, errs) =>
  if names.length == 0
    then errs
    else fold_prods_rep(names.slice(1), prods, nullable,
      walk_rep(prods.get(names[0]).rule, names[0], nullable, errs))

walk_rep(rule, prod_name, nullable, errs) => when rule.kind
  is "rep"     then
    sep_nullable = rule.sep == none or is_nullable(rule.sep, nullable)
    after_check = if is_nullable(rule.item, nullable) and sep_nullable
      then errs.concat([{
        code: "E_INFINITE_REP",
        message: "Rep of a nullable item with no non-nullable separator",
        production: prod_name,
      }])
      else errs
    after_item = walk_rep(rule.item, prod_name, nullable, after_check)
    if rule.sep == none
      then after_item
      else walk_rep(rule.sep, prod_name, nullable, after_item)
  is "seq"     then fold_rep(rule.items,   prod_name, nullable, errs)
  is "alt"     then fold_rep(rule.options, prod_name, nullable, errs)
  is "opt"     then walk_rep(rule.item, prod_name, nullable, errs)
  is "guarded" then walk_rep(rule.item, prod_name, nullable, errs)
  is _         then errs

fold_rep(items, prod_name, nullable, errs) =>
  if items.length == 0
    then errs
    else fold_rep(items.slice(1), prod_name, nullable,
      walk_rep(items[0], prod_name, nullable, errs))

// =============================================================================
// Reservation consistency — every @reserved(name) must refer to a declared set.
// =============================================================================

check_reservations(grammar) =>
  fold_prods_res(grammar.productions.keys(), grammar.productions, grammar.reserved, [])

fold_prods_res(names, prods, reserved_sets, errs) =>
  if names.length == 0
    then errs
    else fold_prods_res(names.slice(1), prods, reserved_sets,
      walk_res(prods.get(names[0]).rule, names[0], reserved_sets, errs))

walk_res(rule, prod_name, reserved_sets, errs) => when rule.kind
  is "guarded" then
    after_guard = if rule.guard.kind == "reserved"
      and reserved_sets.has(rule.guard.setName) == false
      then errs.concat([{
        code: "E_UNDEFINED_RESERVED_SET",
        message: "reserved set '" + rule.guard.setName + "' is not declared",
        production: prod_name,
      }])
      else errs
    walk_res(rule.item, prod_name, reserved_sets, after_guard)
  is "seq"     then fold_res(rule.items,   prod_name, reserved_sets, errs)
  is "alt"     then fold_res(rule.options, prod_name, reserved_sets, errs)
  is "rep"     then
    after_item = walk_res(rule.item, prod_name, reserved_sets, errs)
    if rule.sep == none
      then after_item
      else walk_res(rule.sep, prod_name, reserved_sets, after_item)
  is "opt"     then walk_res(rule.item, prod_name, reserved_sets, errs)
  is _         then errs

fold_res(items, prod_name, reserved_sets, errs) =>
  if items.length == 0
    then errs
    else fold_res(items.slice(1), prod_name, reserved_sets,
      walk_res(items[0], prod_name, reserved_sets, errs))

// =============================================================================
// Left recursion — productions whose leftmost reachable rule is self-referential.
// =============================================================================

check_left_recursion(grammar, nullable) =>
  classify_lr(grammar.productions.keys(), grammar.productions, nullable, [])

classify_lr(names, prods, nullable, acc) =>
  if names.length == 0
    then acc
    else if left_recurses_at_start(prods.get(names[0]).rule, names[0], nullable)
      then classify_lr(names.slice(1), prods, nullable, acc.concat([names[0]]))
      else classify_lr(names.slice(1), prods, nullable, acc)

left_recurses_at_start(rule, target, nullable) => when rule.kind
  is "nonterm" then rule.name == target
  is "seq"     then check_seq_lr(rule.items,   target, nullable)
  is "alt"     then any_lr(rule.options, target, nullable)
  is "rep"     then left_recurses_at_start(rule.item, target, nullable)
  is "opt"     then left_recurses_at_start(rule.item, target, nullable)
  is "guarded" then left_recurses_at_start(rule.item, target, nullable)
  is _ then false

check_seq_lr(items, target, nullable) =>
  if items.length == 0
    then false
    else if left_recurses_at_start(items[0], target, nullable)
      then true
      else if is_nullable(items[0], nullable)
        then check_seq_lr(items.slice(1), target, nullable)
        else false

any_lr(items, target, nullable) =>
  if items.length == 0
    then false
    else if left_recurses_at_start(items[0], target, nullable)
      then true
      else any_lr(items.slice(1), target, nullable)

// =============================================================================
// Top-level analyze — run all checks, return a unified report.
// =============================================================================

analyze(grammar) =>
  nullable = compute_nullability(grammar)
  errors = concat_all([
    check_defined(grammar),
    check_infinite_rep(grammar, nullable),
    check_reservations(grammar),
  ])
  warnings = check_reachable(grammar)
  left_rec = check_left_recursion(grammar, nullable)
  {
    errors: errors,
    warnings: warnings,
    nullable: nullable,
    leftRec: left_rec,
  }
