- for builds and deployments: build frontend without cache always. For any build use prod docker file.
- use docker compose (without hyphen)
- use cache for building only for frontend. Backend only when needed.

## Architecture Notes

### Workflow Execution System (IMPORTANT)
**We use COMPONENTS, not coordinators!**
- The workflow execution system is based on **workflow_components** (not coordinator_agents)
- Old references to `coordinator_agents` table should be removed
- Workflows link directly to components via the `workflows` table
- Component-based architecture: Orchestrator spawns component agents (PM, Explorer, Architect, Designer, Implementer, etc.)
- Do NOT reference or query coordinator_agents table - it doesn't exist in current schema