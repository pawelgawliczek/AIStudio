#!/bin/bash
# Install AI Studio Git Hooks

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
GIT_HOOKS_DIR=".git/hooks"

echo "Installing AI Studio Git Hooks..."

# Check if .git directory exists
if [ ! -d ".git" ]; then
  echo "Error: Not a git repository. Please run this script from the repository root."
  exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p "$GIT_HOOKS_DIR"

# Install post-commit hook
if [ -f "$GIT_HOOKS_DIR/post-commit" ]; then
  echo "Warning: post-commit hook already exists. Creating backup..."
  mv "$GIT_HOOKS_DIR/post-commit" "$GIT_HOOKS_DIR/post-commit.backup"
fi

cp "$SCRIPT_DIR/post-commit" "$GIT_HOOKS_DIR/post-commit"
chmod +x "$GIT_HOOKS_DIR/post-commit"

echo "✓ post-commit hook installed"

# Create .env.git if it doesn't exist
if [ ! -f ".env.git" ]; then
  cat > .env.git <<EOF
# AI Studio Git Hooks Configuration
# Source this file before making commits: source .env.git

export AISTUDIO_API_URL="http://localhost:3000"
export AISTUDIO_API_TOKEN="your-jwt-token-here"
export AISTUDIO_PROJECT_ID="your-project-id-here"

# To get your JWT token:
# 1. Login to AI Studio
# 2. Copy the token from browser localStorage or API response
# 3. Paste it here

# To get your project ID:
# 1. Go to Projects page
# 2. Click on your project
# 3. Copy the project ID from the URL or project details
EOF
  echo "✓ Created .env.git template"
  echo ""
  echo "Please configure .env.git with your credentials:"
  echo "  1. Edit .env.git"
  echo "  2. Set AISTUDIO_API_TOKEN and AISTUDIO_PROJECT_ID"
  echo "  3. Run: source .env.git"
  echo ""
fi

echo ""
echo "Git hooks installed successfully!"
echo ""
echo "Usage:"
echo "  1. Configure credentials: edit .env.git"
echo "  2. Load environment: source .env.git"
echo "  3. Make commits with story keys: git commit -m 'ST-42: Add feature'"
echo "  4. Commits will be automatically linked to stories"
echo ""

exit 0
