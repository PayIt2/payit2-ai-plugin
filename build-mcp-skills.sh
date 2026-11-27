#!/usr/bin/env bash
# Build server-ready copies of the plugin's skills for the MCP skills extension (SEP-2640).
# Output: $OUT/mcp-skills/payit2-skills.ts (one generated TypeScript module). OUT defaults to dist/.
#
# Serves five skills: campaign, check-in, promote, engage and a trimmed campaign-context.
# get-started stays plugin-only. The transform rules live in scripts/build_mcp_skills.py; each is
# replace-or-fail, and a banned-pattern check fails the build if a Claude Code-only construct survives.
# The module records the commit from `git rev-parse HEAD`, so the script refuses to run on a dirty
# tree unless --allow-dirty is given (for tests).
#
# Usage:
#   ./build-mcp-skills.sh [--allow-dirty]
set -euo pipefail
cd "$(dirname "$0")"

OUT="${OUT:-dist}"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"

exec python3 scripts/build_mcp_skills.py --repo . --out "$OUT/mcp-skills" "$@"
