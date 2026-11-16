// The content hash of each shipped primitive, taken over its host code.
//
// Whose: the kernel stream (lane R). By the maintainer's ruling of
// 2026-11-16 a shipped primitive is named by a hash over its host code.
// The host code of one primitive is two things: the helpers every
// primitive shares, which are everything in index.ts above the list, and
// the primitive's own entry in the list. Comment lines and blank lines are
// left out, so rewording a comment changes no hash.
//
// The hashes are committed in hashes.ts, because a hash must be the same
// wherever the code runs and a browser cannot read the source. A test
// computes them again from the source and compares.
//
//   npx tsx next/prims/hash-source.ts --write     write hashes.ts again

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Text } from "../kernel/hash.js";

const LIST = "export const shipped";
const ENTRY = /^  (?:float2|floatTest|int2|intTest|primitive)\("([a-z.]+)"/;

/** The hash of each primitive, by name, from the text of index.ts. */
export function sourceHashes(source: string): Record<string, string> {
  const lines = source.split("\n").filter((l) => l.trim() !== "" && !l.trim().startsWith("//"));
  const start = lines.findIndex((l) => l.startsWith(LIST));
  const end = lines.indexOf("];", start);
  if (start < 0 || end < 0) throw new Error("index.ts: the list of shipped primitives was not found");
  const helpers = lines.slice(0, start).join("\n");
  const out: Record<string, string> = {};
  let name: string | undefined;
  let entry: string[] = [];
  const close = () => {
    if (name === undefined) return;
    if (name in out) throw new Error(`index.ts: ${name} is listed twice`);
    out[name] = `sha256:${sha256Text(`allegro primitive\n${name}\n${helpers}\n${entry.join("\n")}`)}`;
  };
  for (const line of lines.slice(start + 1, end)) {
    const m = ENTRY.exec(line);
    if (m !== null) {
      close();
      name = m[1];
      entry = [];
    } else if (name === undefined) throw new Error(`index.ts: a line of the list belongs to no primitive: ${line.trim()}`);
    entry.push(line);
  }
  close();
  return out;
}

/** The text of hashes.ts for these hashes. */
export function hashesFile(hashes: Record<string, string>): string {
  const rows = Object.keys(hashes).sort().map((n) => `  ${JSON.stringify(n)}: ${JSON.stringify(hashes[n])},`);
  return ["// Written by `npx tsx next/prims/hash-source.ts --write`. Do not edit: a test compares it with the source.", "export const HASHES: Readonly<Record<string, string>> = {", ...rows, "};", ""].join("\n");
}

const here = path.dirname(fileURLToPath(import.meta.url));
export const readSource = (): string => fs.readFileSync(path.join(here, "index.ts"), "utf-8");

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes("--write")) {
  fs.writeFileSync(path.join(here, "hashes.ts"), hashesFile(sourceHashes(readSource())));
  console.log("next/prims/hashes.ts written");
}
