# 🚨 TEST MODE ACTIVE 🚨

**CRITICAL REMINDERS FOR AI AGENT:**

## Current Context
- **Story**: ST-64 - Version Management Web UI
- **Worktree**: `/opt/stack/worktrees/st-64-version-management-web-ui`
- **Test Environment**:
  - Local: http://127.0.0.1:5174 (frontend) / http://127.0.0.1:3001 (backend)
  - Public: https://test.vibestudio.pawelgawliczek.cloud
- **Test Database**: postgres://127.0.0.1:5434/vibestudio_test
- **Production URL**: https://vibestudio.pawelgawliczek.cloud (NO "test." prefix!)

## ⛔ FORBIDDEN ACTIONS
- ❌ **DO NOT use MCP tools that modify production data** (create_workflow, update_component, etc.)
- ❌ **DO NOT modify files in main worktree** (`/opt/stack/AIStudio`)
- ❌ **DO NOT deploy to production**
- ❌ **DO NOT run migrations against production database**

## ✅ ALLOWED ACTIONS
- ✅ **Modify code in THIS worktree** (`/opt/stack/worktrees/st-64-version-management-web-ui`)
- ✅ **Query test database** (SELECT queries on port 5434)
- ✅ **Insert test data into test database** (port 5434 only)
- ✅ **Redeploy to test environment** (deploy_to_test_env MCP tool)
- ✅ **Read-only MCP tools** (list_*, get_*, search_*)

## 📊 Test Data
- Test database is seeded with production data snapshot
- Located at: postgres://127.0.0.1:5434/vibestudio_test
- Use `PGPASSWORD=test psql -h 127.0.0.1 -p 5434 -U postgres -d vibestudio_test` for queries

## 🔄 Workflow
1. Make code changes in this worktree
2. Add test data to test DB if needed (SQL INSERT)
3. Redeploy to test: `deploy_to_test_env(storyId: "c7d0cb58-fd1b-4854-995c-345d5d3d1cdf")`
4. Test at http://127.0.0.1:5174
5. Iterate

## 🎯 Current Task
Testing Version Management UI with workflow filtering functionality.
