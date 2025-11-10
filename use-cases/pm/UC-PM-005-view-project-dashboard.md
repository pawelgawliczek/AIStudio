# UC-PM-005: View Project Dashboard

## Actor
Project Manager (PM)

## Preconditions
- PM is authenticated
- PM has access to at least one project

## Main Flow
1. PM navigates to Projects list
2. PM selects a project
3. System displays project dashboard with sections:
   - **Summary Panel:**
     - Total epics (count by status)
     - Total stories (count by status)
     - Active agents/frameworks
     - Current sprint/release
   - **Progress Metrics:**
     - Story completion rate
     - Velocity trend chart (stories/week)
     - Burndown chart for current release
   - **Resource Utilization:**
     - Token usage this week/month
     - Cost breakdown by framework
     - Agent utilization percentages
   - **Quality Indicators:**
     - Open defects by severity
     - Defect leakage rate
     - Code quality trend
   - **Recent Activity:**
     - Latest story completions
     - Recent commits linked to stories
     - Framework executions
4. PM can filter dashboard by:
   - Date range
   - Epic
   - Framework
   - Status
5. PM can drill down into any metric for details
6. PM can export dashboard as PDF or CSV

## Postconditions
- PM has current visibility into project health
- Dashboard data is cached for performance
- User preferences for filters are saved

## Alternative Flows

### 3a. No data available yet
- At step 3, if project is newly created
- System displays empty state with setup instructions
- PM is guided to create first epic/story

### 5a. Drill down into metric
- PM clicks on a metric (e.g., "15 stories in QA")
- System opens filtered story list showing those specific stories
- PM can navigate back to dashboard

### 6a. Schedule dashboard report
- At step 6, PM clicks "Schedule Report"
- System displays scheduling form
- PM sets frequency (daily/weekly/monthly) and recipients
- System creates scheduled job

## Business Rules
- Dashboard updates every 5 minutes
- Historical data retained for 12 months
- Metrics are calculated based on audit log and run data
- Access control: PM can only see projects they have permission for

## Related Use Cases
- UC-PM-001: Create Project
- UC-METRICS-001: View Framework Effectiveness
- UC-PM-010: Create Release

## Acceptance Criteria
- Dashboard loads within 2 seconds
- All metrics are accurate and up-to-date
- Filters work correctly
- Drill-down navigation is intuitive
- Export functionality works for all data ranges
