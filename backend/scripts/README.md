# Database Population Scripts

This directory contains scripts to populate the database with test data and relationships.

## populate-use-case-test-relationships.ts

This script populates the database with the relationships between use cases and the automated test cases we've created.

### What it does:

1. Maps each use case to its corresponding automated tests
2. Creates test case records in the database
3. Links test cases to their parent use cases
4. Tracks which test file implements each test case

### How to run:

```bash
# From the backend directory
npm run ts-node scripts/populate-use-case-test-relationships.ts
```

Or using tsx:

```bash
# From the backend directory
npx tsx scripts/populate-use-case-test-relationships.ts
```

### Prerequisites:

1. Database must be running and accessible
2. At least one project must exist in the database
3. At least one user must exist in the database

### What gets created:

- **Use Cases**: If a use case doesn't exist, it will be created automatically
- **Use Case Versions**: Initial version is created for new use cases
- **Test Cases**: Test case records linked to use cases with the following properties:
  - Key (e.g., TC-PM-001-01)
  - Title
  - Description
  - Test level (unit/integration/e2e)
  - Test file path
  - Status (automated)
  - Priority (high)

### Use Case Coverage:

The script covers the following use cases:

#### Project Management (UC-PM-*)
- UC-PM-001: Create Project
- UC-PM-002: Create Epic
- UC-PM-003: Create Story
- UC-PM-004: Assign Story to Framework

#### Business Analysis (UC-BA-*)
- UC-BA-001: Analyze Story Requirements
- UC-BA-002: Create Use Case
- UC-BA-004: Search Use Case Library
- UC-BA-006: Maintain Layers and Components

#### QA/Testing (UC-QA-*)
- UC-QA-001: Test Story Implementation
- UC-QA-003: Manage Test Case Coverage

#### Development (UC-DEV-*)
- UC-DEV-003: Link Commit to Story

#### Metrics (UC-METRICS-*)
- UC-METRICS-002: View Project Tracker

#### Integration (UC-INT-*)
- UC-INT-001: End-to-End Story Workflow

### Database Schema:

The script works with the following tables:
- `UseCase`: Main use case records
- `UseCaseVersion`: Version history for use cases
- `TestCase`: Test case records
- `Project`: Parent project
- `User`: Creator/assignee

### Example Output:

```
🚀 Starting test case relationship population...

📦 Using project: AI Studio (abc123...)

   ✅ Created use case UC-PM-001
   ✅ Created test case TC-PM-001-01
   ✅ Created test case TC-PM-001-02
   ⏭️  Test case TC-PM-002-01 already exists, skipping
   ...

📊 Summary:
   ✅ Created: 45 test cases
   ⏭️  Skipped: 3 test cases (already exist)
   ❌ Errors: 0

✨ Done!
```

### Customization:

To add more use case mappings, edit the `useCaseToTestCaseMapping` array in the script:

```typescript
{
  useCaseKey: 'UC-YOUR-AREA-001',
  testCases: [
    {
      key: 'TC-YOUR-AREA-001-01',
      title: 'Test description',
      testLevel: 'unit',
      testFilePath: 'path/to/test.spec.ts',
      description: 'Detailed description',
    },
  ],
}
```

### Troubleshooting:

**Error: No project found**
- Create a project first using the API or database seeder

**Error: No user found**
- Create a user first using the API or database seeder

**Error: Duplicate key constraint**
- The script automatically skips existing test cases
- If you see this error, it means the script tried to create a test case that already exists

**Error: Use case not found**
- The script will automatically create missing use cases
- You can also pre-create use cases using the API
