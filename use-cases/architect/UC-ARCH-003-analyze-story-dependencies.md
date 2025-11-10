# UC-ARCH-003: Analyze and Optimize Story Dependencies

## Actor
Architect

## Preconditions
- Architect is authenticated
- Multiple stories exist in planning/analysis phase
- BA analysis is complete for the stories
- Stories have component tags assigned

## Main Flow
1. Architect navigates to Architecture Planning view
2. System displays list of stories pending architecture review
3. Architect clicks "Analyze Dependencies" button
4. System uses MCP tool: `analyze_dependencies({ story_ids, project_id })`
5. System processes and displays dependency analysis:

   **Shared Components:**
   - Stories touching same files/components
   - Grouped by component
   - Conflict risk indicator if parallel work

   **Dependency Graph:**
   - Visual graph showing story relationships
   - Technical dependencies (A must complete before B)
   - Shared resource dependencies
   - Suggested sequence

   **Grouping Recommendations:**
   - Stories that should be grouped together
   - Stories that should be split apart
   - Stories that can run in parallel
   - Optimal batch for agent assignment

   **Risk Analysis:**
   - Stories with high integration complexity
   - Stories blocking multiple others
   - Stories with unclear dependencies

6. Architect reviews recommendations and can:
   - Accept grouping suggestions → merge stories
   - Accept sequencing → add dependency links
   - Split stories touching unrelated components
   - Assign stories to different frameworks for parallel work

7. Architect takes action based on analysis:

   **Option A: Merge related stories**
   - Select stories to merge
   - System creates parent story
   - Original stories become subtasks
   - Dependencies consolidated

   **Option B: Add dependency links**
   - Select two stories
   - Define dependency type (blocks, depends on)
   - System creates link
   - Updates story sequence

   **Option C: Recommend parallel streams**
   - Mark stories as independent
   - Suggest assigning to different frameworks
   - Document in architecture notes

8. Architect documents architectural decisions
9. System updates stories with:
   - Dependency links
   - Grouping changes
   - Architecture notes
   - Recommended sequence
10. System notifies PM of architectural recommendations
11. PM reviews and approves changes

## Postconditions
- Story dependencies are clearly defined
- Stories are optimally grouped or sequenced
- Parallelization opportunities identified
- Conflict risks mitigated
- Architectural decisions documented
- PM can make informed planning decisions

## Alternative Flows

### 5a. Circular dependency detected
- At step 5, system detects circular dependencies
- System highlights the cycle in dependency graph
- Architect must resolve by:
  - Breaking dependency by splitting story
  - Redefining requirements
  - Creating intermediate story
- Cannot proceed until resolved

### 5b. High-risk integration detected
- At step 5, system identifies stories with risky integrations
- Risk factors:
  - Touching same hotspot files
  - Modifying core shared components
  - Multiple concurrent DB schema changes
- System recommends:
  - Sequential execution
  - Additional integration testing
  - Architecture spike to clarify approach

### 7a. Create architecture spike
- At step 7, Architect identifies unclear architectural approach
- Architect creates spike story to investigate:
  - Proof of concept for integration
  - Performance testing
  - Technology evaluation
- Spike blocks dependent stories
- Proceeds after spike completion

### 6a. Auto-apply AI recommendations
- At step 6, Architect clicks "Auto-apply Safe Recommendations"
- System automatically:
  - Links obvious dependencies
  - Groups tightly coupled stories
  - Marks independent stories for parallel work
- Architect reviews changes
- Can undo if needed

## Business Rules
- Dependency types: "blocks", "depends on", "related to"
- Circular dependencies not allowed
- Stories can be grouped only if same epic or related components
- Parallel work allowed only if no shared file modifications
- Maximum dependency chain depth: 5 levels (prevents over-complexity)

## Technical Implementation
- MCP tool analyzes:
  - Component tags from architecture assessment
  - File paths from similar completed stories
  - Code structure from repository
  - Use case linkages from BA analysis
- Graph algorithm detects cycles
- Clustering algorithm suggests groupings based on:
  - Code similarity
  - Component overlap
  - Use case relationships

## Related Use Cases
- UC-ARCH-001: Assess Technical Complexity
- UC-PM-003: Create Story
- UC-PM-007: Plan Sprint/Release
- UC-BA-001: Analyze Story Requirements
- UC-DEV-001: Implement Story

## Acceptance Criteria
- Dependency analysis completes within 10 seconds for 50 stories
- Circular dependencies are detected and prevented
- Grouping recommendations are accurate (>80% accepted by architects)
- Visual dependency graph is clear and interactive
- Risk analysis identifies real integration issues
- PM can easily understand recommendations
- Changes are properly audited
- Parallel work opportunities maximize throughput
