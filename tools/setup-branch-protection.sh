#!/usr/bin/env bash
#
# Configura a proteção da branch principal (TASK 0.5.6).
#
# Exige um token com a permissão "Administration: Read and write" no
# repositório. O PAT fine-grained padrão NÃO tem essa permissão — a API
# responde 403 mesmo com o usuário sendo admin.
#
# Como habilitar:
#   1. github.com/settings/tokens → o token usado pelo gh
#   2. Repository permissions → Administration → Read and write
#   3. Rodar este script
#
# Uso:
#   ./tools/setup-branch-protection.sh [owner/repo]

set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
BRANCH="$(gh repo view "$REPO" --json defaultBranchRef -q .defaultBranchRef.name)"

echo "Aplicando proteção em ${REPO}@${BRANCH}..."

# Os contextos são os `name:` dos jobs em .github/workflows/ci.yml.
gh api -X PUT "repos/${REPO}/branches/${BRANCH}/protection" --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Lint", "Type Check", "Test", "Build"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON

echo
echo "Proteção aplicada. Conferindo:"
gh api "repos/${REPO}/branches/${BRANCH}/protection" \
  --jq '{
    pr_obrigatorio: (.required_pull_request_reviews != null),
    approvals: .required_pull_request_reviews.required_approving_review_count,
    checks: .required_status_checks.contexts,
    force_push_bloqueado: (.allow_force_pushes.enabled | not)
  }'
