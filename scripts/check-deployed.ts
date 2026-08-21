// Deployed-version verification (B-096): compares what is live at
// allegrolang.org against origin/main, so `[stage: live]` designations
// in the Backlog are auditable instead of attested.
//
// deploy.sh stamps `website/version.json` at deploy time; this tool
// fetches it from the live site and renders a verdict. Requires
// network access to the site — run it from a machine that has it
// (the suite tests only the pure verdict logic, no network).
//
// Run: npm run check-deployed          (or: npx tsx scripts/check-deployed.ts)
// Env: ALLEGRO_SITE_URL overrides the site base URL.
// Exit: 0 = live matches origin/main · 1 = stale/mismatched · 2 = unverifiable.

import { execSync } from "child_process";

export interface DeployStamp {
  commit: string;
  branch: string;
  deployedAt: string;
  dirty: boolean;
}

export interface VerdictInput {
  stamp: DeployStamp | null; // null = no version.json on the site
  mainHead: string | null; // origin/main HEAD, null if unknown locally
  liveKnownLocally: boolean; // stamp.commit resolves in the local repo
  behindMain: number | null; // commits on origin/main since the live commit
}

export interface Verdict {
  status: "current" | "stale" | "unverifiable";
  lines: string[];
  exitCode: 0 | 1 | 2;
}

/** Pure verdict logic — unit-tested; all inputs supplied by the caller. */
export function assessDeployment(input: VerdictInput): Verdict {
  const lines: string[] = [];
  const { stamp, mainHead } = input;

  if (stamp === null) {
    lines.push(
      "live site has no version.json — it predates the B-096 stamp.",
      "Redeploy with the updated deploy.sh to make the site auditable."
    );
    return { status: "unverifiable", lines, exitCode: 2 };
  }

  lines.push(
    `live:  ${stamp.commit.slice(0, 7)} (${stamp.branch}${stamp.dirty ? ", DIRTY" : ""}) deployed ${stamp.deployedAt}`
  );
  if (mainHead === null) {
    lines.push("origin/main unknown locally — fetch failed; cannot compare.");
    return { status: "unverifiable", lines, exitCode: 2 };
  }
  lines.push(`main:  ${mainHead.slice(0, 7)} (origin/main)`);

  const warnings: string[] = [];
  if (stamp.branch !== "main") {
    warnings.push(`deployed from branch '${stamp.branch}', not main`);
  }
  if (stamp.dirty) {
    warnings.push("deployed from a DIRTY working tree — live content may match no commit");
  }

  if (stamp.commit === mainHead && !stamp.dirty) {
    lines.push("LIVE IS CURRENT: the site matches origin/main.");
    for (const w of warnings) lines.push(`warning: ${w}`);
    return { status: "current", lines, exitCode: 0 };
  }

  if (!input.liveKnownLocally) {
    lines.push(
      "MISMATCH: the live commit is unknown to this clone (fetch first, or the deploy came from elsewhere)."
    );
  } else if (input.behindMain !== null && input.behindMain > 0) {
    lines.push(
      `STALE: live is ${input.behindMain} commit(s) behind origin/main — redeploy to publish them.`
    );
  } else if (stamp.commit === mainHead && stamp.dirty) {
    lines.push("MISMATCH: live matches origin/main's commit but was deployed dirty.");
  } else {
    lines.push("MISMATCH: live is not an ancestor state of origin/main.");
  }
  for (const w of warnings) lines.push(`warning: ${w}`);
  return { status: "stale", lines, exitCode: 1 };
}

/** Parse a fetched version.json body; returns null on shape mismatch. */
export function parseStamp(text: string): DeployStamp | null {
  try {
    const o = JSON.parse(text);
    if (typeof o.commit !== "string" || typeof o.branch !== "string") return null;
    return {
      commit: o.commit,
      branch: o.branch,
      deployedAt: typeof o.deployedAt === "string" ? o.deployedAt : "(unknown)",
      dirty: o.dirty === true,
    };
  } catch {
    return null;
  }
}

function git(cmd: string): string | null {
  try {
    return execSync(`git ${cmd}`, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const base = process.env.ALLEGRO_SITE_URL ?? "https://allegrolang.org";
  const url = `${base.replace(/\/$/, "")}/version.json`;

  let stamp: DeployStamp | null = null;
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (res.ok) stamp = parseStamp(await res.text());
    else if (res.status !== 404) {
      // Only a clean 404 means "the site predates the stamp"; anything
      // else (403 from a proxy, 5xx, …) is unverifiable, not unstamped.
      console.error(`check-deployed: ${url} answered HTTP ${res.status} — cannot verify from here`);
      process.exit(2);
    }
  } catch (e) {
    console.error(`check-deployed: cannot reach ${url} — ${(e as Error).message}`);
    process.exit(2);
  }

  git("fetch origin main --quiet"); // best-effort freshness
  const mainHead = git("rev-parse origin/main");
  const liveKnownLocally =
    stamp !== null && git(`cat-file -e ${stamp.commit}^{commit} && echo ok`) !== null;
  const behindMain =
    stamp !== null && liveKnownLocally
      ? Number(git(`rev-list --count ${stamp.commit}..origin/main`) ?? "NaN") || 0
      : null;

  const verdict = assessDeployment({ stamp, mainHead, liveKnownLocally, behindMain });
  for (const line of verdict.lines) console.log(line);
  process.exit(verdict.exitCode);
}

const isMain = process.argv[1] && process.argv[1].endsWith("check-deployed.ts");
if (isMain) {
  main();
}
