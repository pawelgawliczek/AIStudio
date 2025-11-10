# UC-BA-002: Create Use Case

## Actor
Business Analyst (BA)

## Preconditions
- BA is authenticated
- Project exists
- BA has permissions to create use cases

## Main Flow
1. BA navigates to Use Case Library
2. BA clicks "Create Use Case" button
3. System displays use case creation form with sections:

   **Basic Info:**
   - Use case key (auto-generated, e.g., UC-LOGIN-001)
   - Title (required)
   - Area/Category (dropdown: Authentication, Billing, Reporting, etc.)
   - Status (draft, active, deprecated)

   **Actors & Scope:**
   - Primary actor (who initiates)
   - Secondary actors (who else is involved)
   - Scope (which system/component)
   - Level (user-goal, sub-function, summary)

   **Main Success Scenario:**
   - Numbered steps describing happy path
   - Rich text editor with formatting

   **Extensions/Alternative Flows:**
   - Alternative paths and error handling
   - Conditional branches

   **Preconditions:**
   - What must be true before use case starts

   **Postconditions:**
   - What is guaranteed after successful completion

   **Special Requirements:**
   - Performance, security, usability requirements
   - Non-functional constraints

4. BA fills in all sections
5. BA optionally uploads:
   - Wireframes/mockups
   - Business process diagrams
   - User flow diagrams
6. BA adds tags for categorization and search
7. BA saves as draft or publishes as active
8. System validates required fields
9. System creates use case with version 1
10. System indexes use case for search
11. System displays success message
12. Use case appears in library

## Postconditions
- Use case is created with version 1
- Use case is searchable in library
- Use case can be linked to stories
- Audit log records creation
- Use case is ready for stakeholder review

## Alternative Flows

### 7a. Save as draft
- At step 7, BA selects "Save as Draft"
- System creates use case with status "draft"
- Use case is not yet linkable to stories
- BA can return to edit later

### 7b. Duplicate existing use case
- At step 2, BA clicks "Duplicate" on existing use case
- System pre-fills form with existing data
- BA proceeds from step 4 with copied content

### 8a. Missing required fields
- At step 8, validation fails
- System highlights missing required sections
- BA returns to step 4

### 12a. Enable semantic search indexing
- After step 11, system automatically:
  - Generates embeddings for use case content
  - Stores vectors for semantic search
  - Updates RAG index

## Business Rules
- Use case keys are unique within project
- Key format: UC-[AREA]-[NUMBER] (e.g., UC-AUTH-001)
- Only "active" use cases can be linked to stories
- Minimum required fields for active status:
  - Title, primary actor, main success scenario, preconditions, postconditions
- Use cases are versioned (v1, v2, etc.)
- Version 1 always created on initial save

## Related Use Cases
- UC-BA-001: Analyze Story Requirements
- UC-BA-003: Update Use Case
- UC-BA-004: Link Use Case to Story
- UC-BA-006: Search Use Case Library

## Acceptance Criteria
- Use case is created with proper structure
- All required fields are validated
- Use case is searchable immediately
- Attachments are properly stored and accessible
- Version 1 is automatically created
- Semantic search indexing works (can find by natural language query)
