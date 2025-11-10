# ADR-001: Progressive Disclosure Pattern for MCP Server

**Status:** Accepted
**Date:** 2025-11-10
**Decision Makers:** Backend Team, DevOps, Project Manager
**Consulted:** Anthropic Engineering (via published research)
**Informed:** Full development team

---

## Context

### Problem Statement

Our AI Studio MCP (Model Context Protocol) server currently loads all tool definitions upfront in a static array and returns them on every `ListToolsRequest`. As of Sprint 3, we have 10 tools (~5KB of schema data). Our roadmap indicates growth to 50+ tools by Sprint 12, which would result in ~25KB of tool definitions being sent on every discovery request.

**Current Implementation:**
```typescript
// backend/src/mcp/server.ts (Sprint 3)
const TOOLS: Tool[] = [
  { name: 'bootstrap_project', description: '...', inputSchema: {...} },
  { name: 'create_project', description: '...', inputSchema: {...} },
  // ... 10 tools, ~5KB total
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS }; // Returns ALL tools every time
});
```

### Key Issues with Current Approach

1. **Token Waste:** Every tool discovery request consumes 5KB (10 tools) → 25KB (50 tools) in tokens
2. **Agent Slowdown:** Unnecessary context processing delays agent response times by 30-50%
3. **Poor Scalability:** Linear growth in token costs with tool count
4. **Inefficient Discovery:** Agents must process full schemas even when just browsing

### Research Foundation

Anthropic's engineering team published research on proficient MCP server design in their article ["Code Execution with MCP"](https://www.anthropic.com/engineering/code-execution-with-mcp), identifying progressive disclosure as a key efficiency pattern:

> **Key Finding:** "Loading all tool definitions upfront and passing intermediate results through the context window slows down agents and increases costs. Agents should load only necessary tool definitions on-demand, reducing token usage by up to 98.7%."

**Recommended Approach:**
- File-based tool discovery using filesystem structure
- Progressive disclosure with detail-level parameters (names only, with descriptions, full schema)
- On-demand loading instead of upfront registration

---

## Decision

**We will adopt the Progressive Disclosure pattern for our MCP server**, implementing:

1. **File-Based Tool Organization**
   - Restructure tools from monolithic files into `backend/src/mcp/servers/` hierarchy
   - Each tool becomes a separate file with standardized exports
   - Automatic discovery via filesystem scanning

2. **Progressive Disclosure Mechanism**
   - Implement `search_tools` MCP tool with three detail levels:
     - `names_only`: Returns array of tool names (~100 bytes)
     - `with_descriptions`: Returns names + descriptions (~500 bytes)
     - `full_schema`: Returns complete tool definitions (~1KB per tool)
   - Support filtering by category and keyword search

3. **Dynamic Tool Loading**
   - Replace static `TOOLS` array with `ToolRegistry` class
   - Load tool definitions on-demand from filesystem
   - Cache loaded tools in memory for performance

4. **Enhanced Data Operations**
   - Add pagination to all list operations (default: 20, max: 100)
   - Implement aggregation tools for large dataset summarization
   - Filter before returning data to context

---

## Consequences

### Positive Consequences

✅ **Dramatic Token Reduction**
- Discovery operations: 5KB → 100 bytes (98% reduction)
- At scale (50 tools): 25KB → 100 bytes (99.6% reduction)
- Projected savings: $600/year at 1000 agent sessions/month

✅ **Improved Agent Performance**
- 30-50% faster response times due to reduced context processing
- Better user experience in Claude Code CLI

✅ **Scalability to 50+ Tools**
- Ready for Phase 3-4 tool expansion
- No degradation as tool count grows
- Constant-time discovery regardless of tool count

✅ **Better Developer Experience**
- Clear file organization: `servers/projects/create_project.ts`
- Auto-discovery: no manual registration needed
- Easier to find and modify tools

✅ **Industry Best Practices**
- Alignment with Anthropic's recommendations
- Production-grade architecture from the start
- Future-proof for code execution (Phase 3)

### Negative Consequences

⚠️ **Increased Architectural Complexity**
- Dynamic loading adds indirection
- More components: ToolLoader, ToolRegistry, discovery logic
- Steeper learning curve for new contributors

⚠️ **Migration Effort Required**
- Sprint 4.5 (3 weeks) to implement
- 10 existing tools must be restructured
- Documentation updates across multiple files
- Testing overhead

⚠️ **Potential Performance Overhead**
- Dynamic imports may be slower than static
- Filesystem scanning on startup
- **Mitigation:** Aggressive caching, benchmarking

⚠️ **Breaking Change for ListToolsRequest**
- Old: Returns all tools
- New: Returns only meta tools (search_tools)
- **Mitigation:** Agents should use search_tools instead; backward compatibility via search_tools({ category: 'all' })

### Neutral Consequences

ℹ️ **Tool Interface Unchanged**
- Existing tool parameters and responses remain the same
- Claude Code integration works without modification
- No breaking changes for tool execution

ℹ️ **Parallel Development Impact**
- Sprint 4.5 inserts between 4 and 5
- Delays Use Case Library by 3 weeks
- Total timeline unchanged (still 12 sprints to MVP)

---

## Alternatives Considered

### Alternative 1: Status Quo (Do Nothing)

**Description:** Keep static TOOLS array, load all tools upfront

**Pros:**
- ✅ Simplest approach
- ✅ No migration effort
- ✅ Works fine for 10-20 tools

**Cons:**
- ❌ Doesn't scale to 50+ tools
- ❌ Wastes tokens and performance
- ❌ Ignores industry best practices

**Decision:** Rejected - Technical debt would accumulate, requiring painful migration later

---

### Alternative 2: Lazy Loading Only (No Progressive Disclosure)

**Description:** Load tools dynamically but still return all definitions on ListToolsRequest

**Pros:**
- ✅ Better file organization
- ✅ Auto-discovery benefits
- ✅ Simpler than full progressive disclosure

**Cons:**
- ❌ Still sends all schemas on every request
- ❌ No token savings on discovery
- ❌ Partial solution to the problem

**Decision:** Rejected - Doesn't address core token waste issue

---

### Alternative 3: Hybrid Approach

**Description:** Core tools upfront, extended tools on-demand

**Pros:**
- ✅ Common tools immediately available
- ✅ Extended tools don't bloat context
- ✅ Gradual migration path

**Cons:**
- ❌ Complexity of maintaining two systems
- ❌ Arbitrary distinction between "core" and "extended"
- ❌ Still wastes tokens on core tool definitions

**Decision:** Rejected - Half-measure that doesn't fully solve the problem

---

### Alternative 4: GraphQL-style Query for Tools

**Description:** Allow agents to specify which tool fields they want

**Pros:**
- ✅ Flexible field selection
- ✅ Fine-grained control

**Cons:**
- ❌ Significant implementation complexity
- ❌ Not aligned with Anthropic's recommendations
- ❌ Over-engineering for current needs

**Decision:** Rejected - Progressive disclosure achieves same benefits with less complexity

---

## Implementation

### Timeline: Sprint 4.5 (3 weeks)

**Week 1: Foundation**
- Add pagination to list operations
- Implement aggregation tools
- Design file structure

**Week 2: Core Implementation**
- Build ToolLoader and ToolRegistry
- Migrate tools to servers/ directory
- Implement search_tools

**Week 3: Integration & Docs**
- Refactor server.ts
- Comprehensive testing
- Update documentation

### Key Components

1. **File Structure**
   ```
   backend/src/mcp/
   ├── servers/
   │   ├── projects/
   │   │   ├── bootstrap_project.ts
   │   │   ├── create_project.ts
   │   │   └── ...
   │   ├── epics/
   │   ├── stories/
   │   └── meta/
   │       └── search_tools.ts
   ├── core/
   │   ├── loader.ts
   │   ├── registry.ts
   │   └── discovery.ts
   └── server.ts
   ```

2. **Tool File Format**
   ```typescript
   // Each tool file exports:
   export const tool: Tool = { name, description, inputSchema };
   export const metadata = { category, tags, version };
   export async function handler(prisma, params) { /* ... */ }
   ```

3. **Progressive Discovery Flow**
   ```
   Agent → search_tools({ detail_level: 'names_only' })
        → ['bootstrap_project', 'create_project', ...]
        → ~100 bytes

   Agent → search_tools({ category: 'projects', detail_level: 'with_descriptions' })
        → [{ name, description, category }, ...]
        → ~500 bytes

   Agent → search_tools({ query: 'bootstrap', detail_level: 'full_schema' })
        → [{ name, description, inputSchema, metadata }]
        → ~1KB

   Agent → bootstrap_project({ name: 'MyApp' })
        → Execute tool
   ```

### Testing Strategy

- **Unit Tests:** ToolLoader, ToolRegistry, tool implementations (>80% coverage)
- **Integration Tests:** End-to-end discovery and execution workflows
- **Performance Tests:** Token usage benchmarks, response time SLAs
- **Migration Tests:** Verify all Sprint 3 tools work unchanged

### Success Criteria

- [ ] Token reduction >90% for discovery operations
- [ ] All existing tools work without modification
- [ ] Response times meet or beat Sprint 3 baseline
- [ ] Documentation complete and accurate
- [ ] Test coverage >80%

---

## Risks & Mitigation

### Risk 1: Performance Regression

**Risk:** Dynamic loading slower than static imports
**Mitigation:** Aggressive caching, pre-loading common tools, benchmarking
**Contingency:** Revert to static imports with progressive disclosure abstraction

### Risk 2: Breaking Changes

**Risk:** Existing integrations break
**Mitigation:** Backward compatibility, comprehensive testing, gradual rollout
**Contingency:** Maintain dual support (tools/ and servers/) for 1-2 sprints

### Risk 3: Incomplete Documentation

**Risk:** Contributors confused by new structure
**Mitigation:** MIGRATION.md guide, examples, ADR (this document)
**Contingency:** Office hours, pair programming sessions

---

## Success Metrics

### Quantitative Metrics

| Metric | Sprint 3 (Baseline) | Sprint 4.5 (Target) | Actual |
|--------|---------------------|---------------------|--------|
| Discovery token usage (10 tools) | ~5KB | ~100 bytes | TBD |
| Discovery token usage (50 tools) | ~25KB | ~100 bytes | TBD |
| Tool execution time | 50ms (p95) | <50ms (p95) | TBD |
| Test coverage | 85% | >80% | TBD |

### Qualitative Metrics

- [ ] Developer feedback: "Easier to find and add new tools"
- [ ] Agent performance: "Noticeably faster responses"
- [ ] Code quality: "Cleaner organization, easier to maintain"

---

## References

1. **Anthropic Engineering:** [Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)
2. **Sprint 4.5 Technical Spec:** `docs/sprint-4.5-technical-spec.md`
3. **Architecture Document:** `architecture.md` (Section 8: MCP Patterns)
4. **Migration Guide:** `docs/MIGRATION.md`

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-11-10 | Adopt progressive disclosure | Alignment with Anthropic best practices, 98% token reduction |
| 2025-11-10 | File-based organization | Better developer experience, auto-discovery |
| 2025-11-10 | Three detail levels | Balances flexibility and simplicity |
| 2025-11-10 | Sprint 4.5 timing | After core MCP, before use cases (optimal dependency order) |

---

## Review & Updates

This ADR will be reviewed at:
- **End of Sprint 4.5** (2025-12-01): Validate outcomes match expectations
- **End of Sprint 6** (MVP): Assess impact at scale with use case tools
- **End of Sprint 12** (Production): Final retrospective with 50+ tools

**Next Review Date:** 2025-12-01
**Document Owner:** Backend Team Lead
**Last Updated:** 2025-11-10

---

## Approval

- [x] **Backend Team:** Approved - Implementation plan clear
- [x] **DevOps:** Approved - No infrastructure concerns
- [x] **Project Manager:** Approved - Aligns with roadmap
- [ ] **QA Engineer:** Pending review
- [ ] **Frontend Team:** Informational only (no impact)

**Status:** ✅ **ACCEPTED AND APPROVED FOR IMPLEMENTATION**

---

**ADR Version:** 1.0
**Format:** Markdown Architecture Decision Record
**Template:** [MADR 3.0.0](https://adr.github.io/madr/)
