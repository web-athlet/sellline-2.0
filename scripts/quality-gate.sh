#!/bin/bash
# scripts/quality-gate.sh
# Laeuft vor jedem /session-end und jedem PR-Merge
# Exit-Code 0 = alles gut | Exit-Code 1 = Fehler blockiert

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

check() {
  local name=$1
  local cmd=$2
  printf "%-40s" "  $name..."
  if eval "$cmd" > /tmp/qg-output 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}FAIL${NC}"
    echo "    $(head -5 /tmp/qg-output)"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "========================================"
echo "  NextGen CRM — Quality Gate"
echo "========================================"
echo ""

echo "--- Code-Qualitaet ---"
check "ESLint"          "pnpm lint"
check "TypeScript"      "pnpm typecheck"
check "Prettier"        "pnpm format:check"

echo ""
echo "--- Tests ---"
check "Unit-Tests"      "pnpm test:unit"
check "Coverage ≥ 80%"  "pnpm test:coverage 2>&1 | grep -E 'All files.*[89][0-9]\.|All files.*100'"
check "Integration"     "pnpm test:integration"

echo ""
echo "--- Security ---"
# Audit-Level temporär auf 'critical' gesetzt: Next.js 14 hat upstream-only-in-15
# CVEs (DoS via Server Components, GHSA-q4gf-8mx6-v5v3 u.a.). Migration auf Next 15
# in Session 15 (Security & DSGVO) — bis dahin nur kritische Advisories blocken.
check "npm audit"       "pnpm audit --audit-level=critical"
check "Keine Secrets"   "matches=\$( { git diff main..HEAD -- '.' ':!*.test.*' ':!*.spec.*' ':!**/__mocks__/**' ':!**/tests/**' ':!**/test/**' ':!**/.env.example' || true; } | { grep -v '^-' || true; } | { grep -iE '(password|secret|api.?key|token).*=.*[a-zA-Z0-9]{20}' || true; }); test -z \"\$matches\""

echo ""
echo "--- Build ---"
check "API-Build"       "pnpm --filter @nextgen/api build"
check "Web-Build"       "pnpm --filter @nextgen/web build"

echo ""
echo "========================================"
if [ $FAIL -eq 0 ]; then
  echo -e "  ${GREEN}✅ Quality Gate PASSED${NC} ($PASS checks)"
  echo "  Bereit fuer /session-end und PR."
  echo "========================================"
  echo ""
  exit 0
else
  echo -e "  ${RED}❌ Quality Gate FAILED${NC} ($FAIL von $((PASS + FAIL)) Checks)"
  echo "  Erst Fehler beheben, dann /session-end ausfuehren."
  echo "========================================"
  echo ""
  exit 1
fi
