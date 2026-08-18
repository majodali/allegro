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

out=$(npx tsc --noEmit 2>&1)
bad=$(echo "$out" | grep -E 'error TS' | grep -v 'error TS6059' || true)
sanctioned=$(echo "$out" | grep -c 'error TS6059' || true)

if [ -n "$bad" ]; then
  echo "$bad"
  echo "typecheck FAILED ($(echo "$bad" | wc -l | tr -d ' ') non-sanctioned diagnostics)"
  exit 1
fi
echo "typecheck clean ($sanctioned TS6059 rootDir-convention diagnostics ignored)"
