#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# prepare-opensource.sh
#
# Rewrites git history to:
#   1. Set all author/committer to your real identity
#   2. Strip all Co-Authored-By lines from commit messages
#   3. Replace hardcoded secrets in .env.docker with placeholders
#   4. Replace personal domain references
#
# IMPORTANT: This rewrites ALL commit hashes. After running:
#   - You must force-push to remote (or create a new repo)
#   - Anyone with existing clones must re-clone
#
# Usage:
#   1. Make a BACKUP first:  cp -r .git .git-backup
#   2. Run: bash scripts/prepare-opensource.sh
#   3. Verify: git log --all --format='%an <%ae> | %cn <%ce>' | sort -u
#   4. Verify: git log --all --format='%b' | grep -i co-authored
#   5. Verify: git log -p --all -- .env.docker | grep -E 'SECRET|PASSWORD'
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- Configuration ---
CORRECT_NAME="Pawel Gawliczek"
CORRECT_EMAIL="gawliczek.pawel@gmail.com"

cd "$REPO_DIR"

echo "=== Pre-flight checks ==="

if [ ! -d .git-backup ]; then
    echo "WARNING: No .git-backup found."
    echo "It is STRONGLY recommended to back up first:"
    echo "  cp -r .git .git-backup"
    echo ""
    read -p "Continue without backup? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Aborted. Run: cp -r .git .git-backup"
        exit 1
    fi
fi

echo ""
echo "=== Step 1: Create mailmap for author/committer rewrite ==="

MAILMAP_FILE=$(mktemp)
cat > "$MAILMAP_FILE" << EOF
${CORRECT_NAME} <${CORRECT_EMAIL}> Claude <noreply@anthropic.com>
${CORRECT_NAME} <${CORRECT_EMAIL}> Pawel Gawliczek <pawel@srv1065744.hstgr.cloud>
${CORRECT_NAME} <${CORRECT_EMAIL}> pawelgawliczek <53079327+pawelgawliczek@users.noreply.github.com>
${CORRECT_NAME} <${CORRECT_EMAIL}> pawelgawliczek <gawliczek.pawel@gmail.com>
${CORRECT_NAME} <${CORRECT_EMAIL}> GitHub <noreply@github.com>
EOF

echo "Mailmap contents:"
cat "$MAILMAP_FILE"
echo ""

echo "=== Step 2: Running git filter-repo ==="
echo "This will rewrite ALL commits in the repository."
echo ""

# --commit-callback: raw Python code with 'commit' variable in scope
# --blob-callback: raw Python code with 'blob' variable in scope
# These are NOT function definitions — just inline code.

git filter-repo \
    --mailmap "$MAILMAP_FILE" \
    --commit-callback '
import re
co_author_re = re.compile(rb"\n*\s*[Cc]o-[Aa]uthored-[Bb]y:[^\n]*")
msg = commit.message
msg = co_author_re.sub(b"", msg)
msg = msg.replace(b"pawelgawliczek.cloud", b"example.com")
msg = msg.replace(b"srv1065744.hstgr.cloud", b"server.example.com")
msg = msg.replace(b"srv1065744", b"server")
msg = msg.rstrip() + b"\n"
commit.message = msg
' \
    --blob-callback '
OLD_SECRETS = {
    b"361a30c6d68396be29c7eddc3f9ff1b1cfe07675c707232a370bda33f7c8b518": b"CHANGE_ME_POSTGRES_PASSWORD",
    b"8fe57280c766fdb264caf0b69702a4c729b5b4b3aa922f35bebe2e8d66ab3bb1e9962805810ff51dc492a7b8359717018afd59cf9e18dfdf62cd4b4cddcd5d1d": b"CHANGE_ME_JWT_SECRET",
    b"d6bf8deb82bc401c24ea6f1e835a6a1d5dbe37cc0c17372d7a5738179521c64f5e54ec04bb75fca7f15497fe8bfe776c9c0504ba2f9b744fc865d0bca647ca51": b"CHANGE_ME_JWT_REFRESH_SECRET",
    b"b63dc4cbdce22d24ccf987c297d43e3c71feaa3e0229524e59d5249e9b3e0cf3": b"CHANGE_ME_INTERNAL_API_SECRET",
    b"pawelgawliczek.cloud": b"example.com",
    b"srv1065744.hstgr.cloud": b"server.example.com",
    b"srv1065744": b"server",
}
for old, new in OLD_SECRETS.items():
    if old in blob.data:
        blob.data = blob.data.replace(old, new)
' \
    --force

echo ""
echo "=== Step 3: Verification ==="

echo ""
echo "--- Authors/Committers ---"
git log --all --format='%an <%ae> | %cn <%ce>' | sort -u

echo ""
echo "--- Remaining Co-Authored-By lines ---"
REMAINING=$(git log --all --format='%b' | grep -ic 'co-authored' || true)
echo "Found: $REMAINING"

echo ""
echo "--- Secrets in .env.docker ---"
git log -p --all -- .env.docker | grep -E '(POSTGRES_PASSWORD|JWT_SECRET|JWT_REFRESH_SECRET|INTERNAL_API_SECRET)=' | sort -u

echo ""
echo "--- Domain references in .env.docker ---"
git log -p --all -- .env.docker | grep -E 'pawelgawliczek\.cloud' || echo "None found (good)"

echo ""
echo "=== Done ==="
echo ""
echo "Next steps:"
echo "  1. Review the output above"
echo "  2. If satisfied, re-add your remote:"
echo "     git remote add origin <your-repo-url>"
echo "  3. Force push: git push --force --all"
echo ""

# Cleanup temp files
rm -f "$MAILMAP_FILE"
