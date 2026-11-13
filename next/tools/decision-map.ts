// The decision map (B-196, docs/plans/rebuild-acceptance.md chunk Q1;
// docs/plans/rebuild.md §1 "Decision map", §8 rule 6): `next/decisions.json`
// holds one row per ruled decision of the inventory
// `docs/plans/book-pass-inventory.md`, in the inventory's order, one row
// per line. A row repeats what the inventory says of its decision (part,
// chapter, type, status against the present code, whether phase 1 held
// it), names the stream that owns it, and records where the new tree
// stands on it: its state, the unit that realises it and the acceptance
// corpus cases that test it. This file generates the map once and then
// checks it against the inventory.
//
//   npx tsx next/tools/decision-map.ts            the check (same as --check)
//   npx tsx next/tools/decision-map.ts --check    findings, one per line;
//                                                 exit 1 on any
//   npm run lint:decisions                        the same check
//   npx tsx next/tools/decision-map.ts --summary  the check's last line only,
//                                                 for the status board
//   npx tsx next/tools/decision-map.ts --init     write the map from the
//                                                 inventory; refuses if it exists
//   npx tsx next/tools/decision-map.ts --sync     rewrite the fields derived
//                                                 from the inventory, add rows for
//                                                 new decisions, keep state,
//                                                 unit and cases
//   npx tsx next/tools/decision-map.ts --sync --rename "<old>" "<new>"
//                                                 move a renamed decision's row
//
// Who runs it: both sessions of the rebuild. Each edits only its own rows
// (`owner` R or Q) and moves a row's `state` in the PR that earns the move.
// A change to the inventory that renames, adds or removes a decision
// carries the map's `--sync` in the same PR. `--sync` never guesses a
// rename: a renamed decision shows as one missing row and one orphan row
// until `--rename` moves it, and an orphan row stays until the session
// resolves it by `--rename` or deletes the row itself.
//
// Tested by next/tools/decision-map.test.ts, including against known-bad
// maps (the repository's rule: probe a check before trusting it).

import * as fs from "fs";
import * as path from "path";

// ── The inventory ─────────────────────────────────────────────────────

export const INVENTORY_PATH = "docs/plans/book-pass-inventory.md";
export const MAP_PATH = "next/decisions.json";

export const PARTS = ["I", "II", "III", "IV", "V", "VI"] as const;
export type Part = (typeof PARTS)[number];
export const TYPES = ["capability", "implementation"] as const;
export type DecisionType = (typeof TYPES)[number];
export const PRESENTS = ["settled", "partly built", "open"] as const;
export type Present = (typeof PRESENTS)[number];
export const OWNERS = ["R", "Q", "none"] as const;
export type Owner = (typeof OWNERS)[number];
export const STATES = ["none", "carried", "adapted", "written", "proved"] as const;
export type State = (typeof STATES)[number];

/** The chapters whose decisions phase 1 of the book pass left held, not ruled. */
export const HELD_CHAPTERS = new Set(["Plans as outcome graphs", "Finding solutions to a plan"]);
/** The one chapter of Part VI that the kernel stream owns. */
export const KERNEL_STREAM_CHAPTERS_OF_PART_VI = new Set(["The kernel's interface"]);

/** One `#### ` entry of the section "The decisions, in book order". */
export interface InventoryEntry {
  title: string;
  chapter: string;            // the `### ` heading the entry sits under
  chapterLine: string | null; // the entry's `- Chapter:` line, when present
  status: string | null;      // the `- Status:` line's text
  type: string | null;        // the `- Type:` line's text
  line: number;               // 1-based line of the `#### ` heading
}

export interface Inventory {
  partOf: Map<string, Part>;  // chapter title -> part, from the contents
  entries: InventoryEntry[];
}

/** Read the contents (`**Part <n>: …**` then `<k>. **<chapter>**`) and the decisions section. */
export function parseInventory(text: string): Inventory {
  const lines = text.split("\n");
  const partOf = new Map<string, Part>();
  const entries: InventoryEntry[] = [];
  let part: Part | null = null;
  let inDecisions = false;
  let chapter: string | null = null;
  let entry: InventoryEntry | null = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.startsWith("## ")) {
      inDecisions = raw.trim() === "## The decisions, in book order";
      chapter = null;
      entry = null;
      continue;
    }
    if (!inDecisions) {
      const p = raw.match(/^\*\*Part ([IVX]+):/);
      if (p) { part = (PARTS as readonly string[]).includes(p[1]) ? (p[1] as Part) : null; continue; }
      const c = raw.match(/^\d+\. \*\*(.+?)\*\*/);
      if (c && part !== null) partOf.set(c[1], part);
      continue;
    }
    if (raw.startsWith("### ")) { chapter = raw.slice(4).trim(); entry = null; continue; }
    if (raw.startsWith("#### ")) {
      entry = { title: raw.slice(5).trim(), chapter: chapter ?? "", chapterLine: null, status: null, type: null, line: i + 1 };
      entries.push(entry);
      continue;
    }
    if (entry === null) continue;
    const field = raw.match(/^- (Status|Type|Chapter): (.*)$/);
    if (!field) continue;
    const value = field[2].trim();
    if (field[1] === "Status" && entry.status === null) entry.status = value;
    else if (field[1] === "Type" && entry.type === null) entry.type = value;
    else if (field[1] === "Chapter" && entry.chapterLine === null) entry.chapterLine = value;
  }
  return { partOf, entries };
}

/** The status against the present code, from the `- Status:` line's leading words. */
export function normalisePresent(status: string): Present | null {
  const s = status.trim().toLowerCase();
  if (s.startsWith("settled")) return "settled";       // incl. "settled for proofs"
  if (s.startsWith("partly built")) return "partly built";
  if (s.startsWith("open") || s.startsWith("to prove")) return "open"; // "open, a goal", "open (…)", "to prove"
  return null;
}

/** The first word of the `- Type:` line. */
export function normaliseType(type: string): DecisionType | null {
  const w = type.trim().split(/[\s—,;]+/)[0];
  return (TYPES as readonly string[]).includes(w) ? (w as DecisionType) : null;
}

/** The owner rule of docs/plans/rebuild.md §1 and §4. */
export function ownerOf(part: Part, chapter: string): Owner {
  if (part === "I") return "none";
  if (part === "II" || part === "III" || part === "IV") return "R";
  if (part === "VI" && KERNEL_STREAM_CHAPTERS_OF_PART_VI.has(chapter)) return "R";
  return "Q";
}

/** What the inventory and the owner rule fix for a decision's row. */
export interface Derived {
  title: string;
  part: Part;
  chapter: string;
  type: DecisionType;
  present: Present;
  held?: true;
  owner: Owner;
}

/** Derive every entry's fields; an entry that cannot be derived is an inventory finding. */
export function deriveAll(inv: Inventory): { derived: Derived[]; findings: string[] } {
  const derived: Derived[] = [];
  const findings: string[] = [];
  const seen = new Set<string>();
  for (const e of inv.entries) {
    const at = `inventory line ${e.line} "${e.title}"`;
    if (seen.has(e.title)) findings.push(`${at}: the title appears twice in the inventory`);
    seen.add(e.title);
    if (e.chapterLine !== null && e.chapterLine !== e.chapter) findings.push(`${at}: sits under "${e.chapter}" but its Chapter line says "${e.chapterLine}"`);
    const part = inv.partOf.get(e.chapter);
    if (part === undefined) findings.push(`${at}: chapter "${e.chapter}" is not in the contents`);
    if (e.type === null) findings.push(`${at}: no Type line`);
    if (e.status === null) findings.push(`${at}: no Status line`);
    const type = e.type === null ? null : normaliseType(e.type);
    if (e.type !== null && type === null) findings.push(`${at}: Type "${e.type}" is neither capability nor implementation`);
    const present = e.status === null ? null : normalisePresent(e.status);
    if (e.status !== null && present === null) findings.push(`${at}: Status "${e.status}" is not settled, partly built or open`);
    if (part === undefined || type === null || present === null) continue;
    const d: Derived = { title: e.title, part, chapter: e.chapter, type, present, owner: ownerOf(part, e.chapter) };
    if (HELD_CHAPTERS.has(e.chapter)) d.held = true;
    derived.push(d);
  }
  return { derived, findings };
}

// ── The map ───────────────────────────────────────────────────────────

export interface Row extends Derived {
  state: State;
  unit: string | null;
  cases: string[];
}

export interface DecisionMap { _: string; rows: Row[] }

export const NOTE =
  "The decision map (B-196, docs/plans/rebuild.md §1 'Decision map' and §8 rule 6): one row per decision of docs/plans/book-pass-inventory.md, in its order, one row per line. " +
  "title, part, chapter, type, present (status against the present code) and held are copied from the inventory, and owner follows the owner rule (Part I none; Parts II to IV and the chapter 'The kernel's interface' R, the kernel stream; Part V and the rest of Part VI Q, the acceptance stream); " +
  "next/tools/decision-map.ts --sync rewrites them, so nobody edits them by hand. " +
  "state (none, carried, adapted, written, proved), unit (a path under next/ that realises the decision, required once state is not none) and cases (ids of acceptance-corpus cases) are edited by the owning stream only, on its own rows, in the PR that earns the move; a row owned by none stays at state none. " +
  "Checked by npm run lint:decisions (next/tools/decision-map.ts --check) in CI.";

/** A fresh row for a derived decision. */
export function freshRow(d: Derived): Row {
  return { ...d, state: "none", unit: null, cases: [] };
}

/** The map as generated by `--init`. */
export function initialMap(derived: Derived[]): DecisionMap {
  return { _: NOTE, rows: derived.map(freshRow) };
}

const ROW_KEYS = ["title", "part", "chapter", "type", "present", "held", "owner", "state", "unit", "cases"] as const;

/** One row as one line of JSON, its fields in the fixed order; `held` only when true. */
export function serializeRow(row: Row): string {
  const r = row as unknown as Record<string, unknown>;
  const ordered: Record<string, unknown> = {};
  for (const k of ROW_KEYS) {
    if (k === "held" && r.held !== true) continue;
    ordered[k] = r[k];
  }
  for (const k of Object.keys(r)) if (!(ROW_KEYS as readonly string[]).includes(k)) ordered[k] = r[k];
  return JSON.stringify(ordered);
}

/** The whole file: one row per line, so edits to different rows merge without conflict. */
export function serializeMap(map: DecisionMap): string {
  const rows = map.rows.map((r, i) => `    ${serializeRow(r)}${i < map.rows.length - 1 ? "," : ""}`);
  return `{\n  "_": ${JSON.stringify(map._)},\n  "rows": [\n${rows.join("\n")}\n  ]\n}\n`;
}

// ── The check ─────────────────────────────────────────────────────────

export interface CheckResult { findings: string[]; summary: string }

/** Check a map (parsed JSON, any shape) against the derived decisions. */
export function checkMap(derived: Derived[], map: unknown, fileExists: (rel: string) => boolean): CheckResult {
  const findings: string[] = [];
  const listed = map !== null && typeof map === "object" && Array.isArray((map as { rows?: unknown }).rows);
  const rows: unknown[] = listed ? (map as { rows: unknown[] }).rows : [];
  if (!listed) findings.push("the map has no rows list");

  const index = new Map<string, number>();
  derived.forEach((d, i) => index.set(d.title, i));
  const byTitle = new Map<string, number[]>();
  const owners: Record<string, number> = { R: 0, Q: 0, none: 0 };
  const states: Record<string, number> = { none: 0, carried: 0, adapted: 0, written: 0, proved: 0 };
  let lastIndex = -1;
  let lastTitle = "";

  rows.forEach((raw, i) => {
    const at = `row ${i + 1}`;
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) { findings.push(`${at}: not an object`); return; }
    const r = raw as Record<string, unknown>;
    const title = typeof r.title === "string" ? r.title : null;
    const label = `${at} "${title ?? "?"}"`;
    if (title === null) { findings.push(`${at}: no title`); return; }
    for (const k of Object.keys(r)) if (!(ROW_KEYS as readonly string[]).includes(k)) findings.push(`${label}: unknown field ${k}`);
    byTitle.set(title, [...(byTitle.get(title) ?? []), i + 1]);
    if (typeof r.owner === "string" && r.owner in owners) owners[r.owner]++;
    if (typeof r.state === "string" && r.state in states) states[r.state]++;

    const k = index.get(title);
    if (k === undefined) findings.push(`${label}: orphan row, no decision of the inventory has this title (rename with --sync --rename, or delete the row)`);
    else {
      const d = derived[k];
      for (const f of ["part", "chapter", "type", "present", "owner"] as const) {
        if (r[f] !== d[f]) findings.push(`${label}: ${f} is ${JSON.stringify(r[f])}, the inventory says ${JSON.stringify(d[f])}`);
      }
      if (d.held === true && r.held !== true) findings.push(`${label}: held is missing, the decision is held`);
      if (d.held !== true && "held" in r) findings.push(`${label}: held is ${JSON.stringify(r.held)}, the decision is not held (omit the field)`);
      if (k < lastIndex) findings.push(`${label}: out of the inventory's order, it comes before "${lastTitle}"`);
      else { lastIndex = k; lastTitle = title; }
    }

    const state = r.state;
    if (!(typeof state === "string" && (STATES as readonly string[]).includes(state))) findings.push(`${label}: state ${JSON.stringify(state)} is not one of ${STATES.join(", ")}`);
    const unit = r.unit;
    if (unit !== null && typeof unit !== "string") findings.push(`${label}: unit ${JSON.stringify(unit)} is neither null nor a path`);
    if (typeof unit === "string") {
      const norm = path.posix.normalize(unit);
      if (!norm.startsWith("next/") || norm !== unit) findings.push(`${label}: unit ${unit} is not a path under next/`);
      else if (!fileExists(unit)) findings.push(`${label}: unit ${unit} does not exist`);
    }
    if (typeof state === "string" && state !== "none" && (STATES as readonly string[]).includes(state)) {
      if (unit === null || unit === undefined) findings.push(`${label}: state ${state} with no unit`);
      if (r.owner === "none") findings.push(`${label}: state ${state} on a row owned by none`);
    }
    if (!Array.isArray(r.cases) || r.cases.some((c) => typeof c !== "string")) findings.push(`${label}: cases is not a list of strings`);
  });

  for (const d of derived) {
    const at = byTitle.get(d.title);
    if (at === undefined) findings.push(`decision "${d.title}" (${d.chapter}) has no row`);
    else if (at.length > 1) findings.push(`decision "${d.title}" has ${at.length} rows (rows ${at.join(", ")})`);
  }

  const verdict = findings.length === 0 ? "consistent" : `${findings.length} finding(s)`;
  const summary =
    `decision-map: ${rows.length} rows · R ${owners.R} · Q ${owners.Q} · none ${owners.none} · ` +
    `state none ${states.none}, carried ${states.carried}, adapted ${states.adapted}, written ${states.written}, proved ${states.proved} — ${verdict}`;
  return { findings, summary };
}

// ── Sync ──────────────────────────────────────────────────────────────

export interface SyncResult { map: DecisionMap; added: string[]; orphans: string[]; errors: string[] }

/**
 * Rewrite the inventory-derived fields of every row, in the inventory's
 * order; add a row for each new decision; keep `state`, `unit` and `cases`.
 * A row whose title is no decision is kept, right after the row it followed,
 * and reported as an orphan. `renames` moves rows by title first.
 */
export function syncMap(derived: Derived[], map: DecisionMap, renames: [string, string][] = []): SyncResult {
  const errors: string[] = [];
  const rows = map.rows.map((r) => ({ ...r }));
  const known = new Set(derived.map((d) => d.title));
  for (const [from, to] of renames) {
    const hits = rows.filter((r) => r.title === from);
    if (hits.length !== 1) { errors.push(`rename: ${hits.length} rows titled "${from}"`); continue; }
    if (!known.has(to)) { errors.push(`rename: "${to}" is not a decision of the inventory`); continue; }
    if (rows.some((r) => r.title === to)) { errors.push(`rename: a row titled "${to}" exists already`); continue; }
    hits[0].title = to;
  }
  if (errors.length > 0) return { map, added: [], orphans: [], errors };

  const byTitle = new Map<string, Row[]>();
  for (const r of rows) byTitle.set(r.title, [...(byTitle.get(r.title) ?? []), r]);
  // Orphans ride behind the row they followed in the old map.
  const after = new Map<string | null, Row[]>();
  let prev: string | null = null;
  const orphans: string[] = [];
  for (const r of rows) {
    if (known.has(r.title)) { prev = r.title; continue; }
    orphans.push(r.title);
    after.set(prev, [...(after.get(prev) ?? []), r]);
  }
  const out: Row[] = [...(after.get(null) ?? [])];
  const added: string[] = [];
  for (const d of derived) {
    const existing = byTitle.get(d.title);
    if (existing === undefined) { out.push(freshRow(d)); added.push(d.title); }
    else for (const r of existing) out.push({ ...d, state: r.state, unit: r.unit, cases: r.cases });
    out.push(...(after.get(d.title) ?? []));
  }
  return { map: { _: map._, rows: out }, added, orphans, errors };
}

// ── main ──────────────────────────────────────────────────────────────

function loadDerived(root: string): { derived: Derived[]; findings: string[] } {
  return deriveAll(parseInventory(fs.readFileSync(path.join(root, INVENTORY_PATH), "utf-8")));
}

/** The inventory's findings and the map's, with the summary line. */
export function checkRepository(root: string): CheckResult {
  const { derived, findings: inventoryFindings } = loadDerived(root);
  const mapFile = path.join(root, MAP_PATH);
  if (!fs.existsSync(mapFile)) {
    const r = checkMap(derived, { rows: [] }, () => false);
    return { findings: [...inventoryFindings, `${MAP_PATH} does not exist (generate it with --init)`, ...r.findings], summary: r.summary };
  }
  let map: unknown;
  try { map = JSON.parse(fs.readFileSync(mapFile, "utf-8")); }
  catch (e) { return { findings: [...inventoryFindings, `${MAP_PATH} is not JSON: ${(e as Error).message}`], summary: "decision-map: unreadable" }; }
  const r = checkMap(derived, map, (rel) => fs.existsSync(path.join(root, rel)));
  const findings = [...inventoryFindings, ...r.findings];
  return { findings, summary: r.summary.replace(/— (consistent|\d+ finding\(s\))$/, `— ${findings.length === 0 ? "consistent" : `${findings.length} finding(s)`}`) };
}

function main(): void {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
  const argv = process.argv.slice(2);
  const mapFile = path.join(root, MAP_PATH);

  if (argv.includes("--init")) {
    if (fs.existsSync(mapFile)) { console.error(`${MAP_PATH} exists: the map is generated once; use --sync`); process.exit(1); }
    const { derived, findings } = loadDerived(root);
    if (findings.length > 0) { for (const f of findings) console.error(f); process.exit(1); }
    fs.mkdirSync(path.dirname(mapFile), { recursive: true });
    fs.writeFileSync(mapFile, serializeMap(initialMap(derived)));
    console.log(`${MAP_PATH}: ${derived.length} rows written`);
    return;
  }

  if (argv.includes("--sync")) {
    const renames: [string, string][] = [];
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] !== "--rename") continue;
      if (i + 2 >= argv.length) { console.error("--rename takes two titles: the old and the new"); process.exit(1); }
      renames.push([argv[i + 1], argv[i + 2]]);
      i += 2;
    }
    const { derived, findings } = loadDerived(root);
    if (findings.length > 0) { for (const f of findings) console.error(f); process.exit(1); }
    const map = JSON.parse(fs.readFileSync(mapFile, "utf-8")) as DecisionMap;
    const r = syncMap(derived, map, renames);
    if (r.errors.length > 0) { for (const e of r.errors) console.error(e); process.exit(1); }
    fs.writeFileSync(mapFile, serializeMap(r.map));
    for (const t of r.added) console.log(`added: "${t}"`);
    for (const t of r.orphans) console.log(`orphan, kept: "${t}"`);
    console.log(`${MAP_PATH}: ${r.map.rows.length} rows written`);
    return;
  }

  const { findings, summary } = checkRepository(root);
  if (!argv.includes("--summary")) for (const f of findings) console.log(f);
  console.log(summary);
  if (findings.length > 0) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
