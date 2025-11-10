# UC-QA-001: Test Story Implementation

## Actor
QA Tester (human or agent)

## Preconditions
- Story has status "review" or "qa"
- Code implementation is complete
- Commits are linked to story
- Tests exist and pass in CI
- Story has acceptance criteria defined

## Main Flow
1. QA receives notification that story is ready for testing
2. QA navigates to story detail view
3. System displays Testing panel with:
   - Story description and acceptance criteria
   - Linked use cases (expected behavior)
   - Code changes (commits, files modified, LOC)
   - Test coverage report (from CI)
   - Implementation notes from developer

4. QA reviews implementation against acceptance criteria
5. QA uses MCP tool: `get_impacted_tests({ files: ["file1", "file2", ...] })`
6. System returns:
   - Existing test cases covering modified files
   - Use cases potentially affected by changes
   - Suggested additional test scenarios
   - Code coverage gaps

7. QA creates test plan (or reviews auto-generated):
   - Test scenarios per acceptance criterion
   - Test data requirements
   - Edge cases to verify
   - Regression tests needed

8. QA executes tests:
   - **Automated tests:**
     - Verify existing tests pass
     - Review test coverage (must meet threshold, e.g., 80%)
     - Run integration tests
   - **Manual tests:**
     - Execute test scenarios
     - Verify against use case flows
     - Test edge cases
     - Perform exploratory testing

9. QA documents results:
   - Pass/fail per acceptance criterion
   - Screenshots or recordings (for UI changes)
   - Performance observations
   - Issues found

10. **If all tests pass:**
    - QA calls MCP: `update_story({ story_id, status: "done" })`
    - QA marks all acceptance criteria as verified
    - Story moves to "done"
    - PM notified of completion

11. **If defects found:**
    - QA creates defect via MCP: `report_defect({ story_id, origin_story_id, origin_stage: "dev", discovery_stage: "qa", severity, violated_use_cases })`
    - QA documents steps to reproduce
    - QA links defect to original story
    - Story status set to "qa_failed"
    - Developer notified to fix

12. QA logs testing session via MCP: `log_run({ project_id, story_id, agent_id: qa_agent_id, success: true/false })`

## Postconditions
- Story is either approved (done) or rejected (qa_failed)
- Test results are documented
- Defects are created and linked (if any)
- Test coverage is verified
- Use case compliance is confirmed
- Audit log records QA activity
- Metrics updated (defect leakage, test effectiveness)

## Alternative Flows

### 11a. Create defect for acceptance criterion failure
- At step 11, specific acceptance criterion not met
- QA creates defect:
  - Type: "defect"
  - Severity: based on impact (critical if blocks usage)
  - Description: "Acceptance criterion #3 not met: ..."
  - Links to failed criterion
  - Links to violated use case
- Defect linked to original story
- QA can choose:
  - Block story (status: "qa_failed") - requires fix before done
  - Create separate defect story - story can proceed if non-critical

### 11b. Create defect for regression
- At step 11, new code broke existing functionality
- QA creates defect:
  - Origin_stage: "dev"
  - Discovery_stage: "qa"
  - Violated_use_cases: [list of affected use cases]
  - Severity: based on regression impact
- Defect linked to story that introduced regression
- Story blocked until regression fixed

### 6a. Insufficient test coverage
- At step 6, coverage below threshold (e.g., < 80%)
- System flags coverage gap
- QA can:
  - Request additional tests from developer
  - Write tests themselves (if QA has dev skills)
  - Escalate to Architect for decision (accept lower coverage?)

### 8a. Tests fail in CI
- At step 8, automated tests fail
- QA reviews failure logs
- QA determines:
  - Test is correct, implementation is wrong → create defect
  - Test is outdated, needs update → update test or ask developer
  - Test is flaky → mark for investigation

### 12a. Performance issue detected
- During testing, QA notices performance degradation
- QA creates performance defect:
  - Type: "defect"
  - Severity: based on impact
  - Description: includes timing measurements
  - Links to performance requirements (if specified)

## Business Rules
- Story cannot move to "done" without QA approval (unless QA explicitly skipped)
- Test coverage must meet project threshold (default 80%)
- All acceptance criteria must be verified
- Defects must link to violating story and affected use cases
- Discovery_stage must be accurate for defect leakage tracking
- Critical/high severity defects block story completion

## Related Use Cases
- UC-QA-002: Map Tests to Use Cases
- UC-QA-003: Report Defect
- UC-DEV-002: Implement Story
- UC-BA-003: View Use Case Impact Analysis
- UC-METRICS-002: View Defect Leakage Report

## Acceptance Criteria
- All acceptance criteria are tested and verified
- Test coverage meets threshold
- Use case compliance is confirmed
- Defects are properly created and linked
- Test results are documented with evidence
- Story status reflects QA decision
- Metrics capture QA effectiveness (defects found, test coverage)
- Regression testing is performed
- Performance is validated (if applicable)
