#!/usr/bin/env bash
# Sanctioned typecheck invocation (B-005).
#
# Repo convention: bench/, pcp/, and scripts/ live OUTSIDE tsconfig's
# rootDir (./src) — they are run via tsx and validated by the test suite,
# not compiled by tsc (documented in CLAUDE.md for bench/ and pcp/).
# tsc therefore reports TS6059 for the src->bench/pcp/scripts imports by
# design. This wrapper fails on every diagnostic EXCEPT that sanctioned
# family, so CI catches real type errors without fighting the convention.
set -uo pipefail

# B-127: invoke the compiler EXPLICITLY. `npx tsc` resolves through
# node_modules/.bin, where any package shipping a `tsc` bin can shadow the
# one meant to gate the build — which is exactly what happened when the
# analyzer's TypeScript 5 was alias-installed alongside the project's 7.
out=$(node node_modules/typescript/lib/tsc.js --noEmit 2>&1)
bad=$(echo "$out" | grep -E 'error TS' | grep -v 'error TS6059' || true)
sanctioned=$(echo "$out" | grep -c 'error TS6059' || true)

if [ -n "$bad" ]; then
  echo "$bad"
  echo "typecheck FAILED ($(echo "$bad" | wc -l | tr -d ' ') non-sanctioned diagnostics)"
  exit 1
fi
echo "typecheck clean ($sanctioned TS6059 rootDir-convention diagnostics ignored)"
