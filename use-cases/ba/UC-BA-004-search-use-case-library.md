# UC-BA-004: Search and Navigate Use Case Library

## Actor
Business Analyst (BA), also available to PM, Architect, Developer

## Preconditions
- User is authenticated
- Use case library exists with indexed use cases

## Main Flow
1. User navigates to Use Case Library
2. System displays library home with:
   - Search bar with autocomplete
   - Category tree view (hierarchical navigation)
   - Recent use cases
   - Most frequently linked use cases
   - Use cases needing review

3. User can search using:
   - **Text search:** keywords in title/description
   - **Semantic search:** natural language queries
     - Example: "how do users change their password?"
   - **Advanced filters:**
     - Category/Area
     - Status (active, draft, deprecated)
     - Actor
     - Last modified date
     - Linked story count
     - Has defects (yes/no)
     - Test coverage range

4. User enters search query or applies filters
5. System processes query:
   - Text search: keyword matching
   - Semantic search: vector similarity search using embeddings
   - Filters: database query

6. System displays results with:
   - Relevance score (for semantic search)
   - Use case key, title, area
   - Excerpt showing matching content
   - Linked story count
   - Last modified date
   - Status indicator

7. Results are sorted by:
   - Relevance (default for semantic search)
   - Last modified (default for text search)
   - User-selected sort (title, area, story count)

8. User can:
   - Click result to view full use case
   - Preview use case in modal without leaving results
   - Add to "My Favorites"
   - Export selected results

9. User selects a use case
10. System displays full use case detail (see UC-BA-003)

## Postconditions
- User finds relevant use cases quickly
- Search queries are logged for analytics
- User can navigate to detailed views

## Alternative Flows

### 3a. Browse by category tree
- At step 3, user clicks category in tree view
- System shows all use cases in that category
- User can expand subcategories
- User proceeds to step 9

### 3b. Natural language query
- At step 4, user enters question: "What happens when a user logs in with wrong password?"
- System uses semantic search on embeddings
- Returns closest matching use cases
- Highlights relevant sections in results

### 6a. No results found
- At step 6, search returns no matches
- System suggests:
  - Broadening search terms
  - Removing filters
  - Creating new use case if needed
- System shows similar categories that might have relevant content

### 8a. Quick actions from results
- At step 8, user right-clicks or uses context menu
- Options:
  - "Show impact analysis"
  - "View version history"
  - "Create related story"
  - "Link to current story" (if in story context)

## Business Rules
- Semantic search requires use cases to have vector embeddings
- Search indexes update within 5 minutes of use case changes
- Only active and draft use cases appear in search (deprecated require explicit filter)
- Access control applies - users see only permitted use cases
- Search queries logged for improving relevance

## Technical Notes
- Semantic search implementation:
  - Use case content (title, description, flows) → embeddings
  - User query → embedding
  - Cosine similarity to find top K matches
  - Can use OpenAI embeddings or open-source alternatives
- Full-text search uses PostgreSQL full-text search or Elasticsearch

## Related Use Cases
- UC-BA-002: Create Use Case
- UC-BA-003: View Use Case Impact Analysis
- UC-BA-001: Analyze Story Requirements
- UC-DEV-002: Find Relevant Use Cases for Story

## Acceptance Criteria
- Text search returns results within 1 second
- Semantic search returns results within 2 seconds
- Autocomplete suggests relevant terms
- Filters work correctly in combination
- Relevance ranking is accurate for semantic search
- Preview modal loads quickly
- Export functionality works for all result sets
- Category tree is intuitive and complete
