# File-to-UseCase Mapping Implementation Summary

## Overview

This implementation adds comprehensive file-to-usecase mapping and impact analysis capabilities to the AI Studio platform.

## What Was Implemented

### 1. Database Schema (`backend/prisma/schema.prisma`)

**New Model: `FileUseCaseLink`**
- Links files to use cases with confidence scoring
- Tracks mapping source (commit-derived, AI-inferred, manual, etc.)
- Records occurrences and temporal data
- Includes indexes for performance

**New Enum: `MappingSource`**
- COMMIT_DERIVED (0.8 confidence)
- AI_INFERRED (0.5 confidence)
- MANUAL (1.0 confidence)
- PATTERN_MATCHED (0.6 confidence)
- IMPORT_ANALYSIS (0.7 confidence)

### 2. Impact Analysis Service (`backend/src/impact-analysis/`)

**Files Created:**
- `impact-analysis.service.ts` - Core business logic
- `impact-analysis.controller.ts` - REST API endpoints
- `impact-analysis.module.ts` - NestJS module

**Key Features:**
- Get use cases affected by file changes
- Get files implementing a use case
- Automatic mapping creation from commits
- Confidence scoring and risk assessment
- Test coverage integration
- Batch analysis for PRs

### 3. REST API Endpoints

**GET `/api/impact-analysis/files-to-usecases`**
- Query params: projectId, filePaths, minConfidence, includeIndirect
- Returns: Affected use cases with confidence, risk levels, related stories

**GET `/api/impact-analysis/usecase-to-files`**
- Query params: projectId, useCaseId/useCaseKey, minConfidence, includeMetrics
- Returns: Implementing files with metrics, recent commits, risk assessment

**POST `/api/impact-analysis/batch`**
- Body: projectId, filePaths[], minConfidence, includeIndirect, context
- Returns: Comprehensive impact report with recommendations

**POST `/api/impact-analysis/create-mapping`**
- Body: projectId, filePath, useCaseId, source, confidence
- Manually create/update file-to-usecase mappings

### 4. MCP Tools (`backend/src/mcp/servers/code-quality/`)

**`analyze_file_impact`**
- Analyze which use cases are affected by file changes
- Perfect for pre-commit analysis and PR risk assessment

**`find_usecase_files`**
- Find all files implementing a use case
- Includes metrics, recent commits, and risk assessment

**`update_file_mappings`**
- Manually create or update file-to-usecase mappings
- Override automatic mappings when needed

### 5. Automatic Mapping Creation

**Updated: `backend/src/mcp/servers/telemetry/link_commit.ts`**
- Automatically creates file-to-usecase mappings when commits are linked to stories
- Only creates mappings if the story has use case links
- Increments occurrence counter for existing mappings
- Returns count of mappings created

### 6. Documentation

**Created: `backend/docs/FILE_TO_USECASE_MAPPING.md`**
- Complete architecture documentation
- Data flow and trigger points
- API specifications with examples
- Implementation plan
- Performance considerations
- Testing strategy

## How It Works

### Automatic Mapping Flow

```
1. Developer commits code
2. Commit linked to Story (via link_commit MCP tool)
3. Story has StoryUseCaseLinks (many-to-many with UseCases)
4. System automatically creates FileUseCaseLink entries:
   - For each file in CommitFiles
   - For each UseCase linked to the Story
   - Source: COMMIT_DERIVED
   - Confidence: 0.8
   - Increments occurrences if mapping exists
```

### Impact Analysis Flow

```
1. Developer modifies files (or plans to)
2. Call analyze_file_impact MCP tool or API
3. System:
   - Finds all FileUseCaseLinks for those files
   - Groups by use case
   - Calculates risk based on:
     * File complexity
     * Maintainability index
     * Test coverage
     * Risk scores
   - Returns ranked list with recommendations
```

### Use Case Implementation Discovery

```
1. Need to understand which files implement UC-AUTH-001
2. Call find_usecase_files MCP tool or API
3. System:
   - Finds all FileUseCaseLinks for that use case
   - Enriches with code metrics
   - Shows recent commits
   - Calculates risk levels
   - Provides recommendations
```

## Example Usage

### MCP Tools

```bash
# Analyze impact of file changes
mcp-tool analyze_file_impact \
  --projectId proj-123 \
  --filePaths backend/src/auth/login.service.ts,backend/src/auth/auth.guard.ts

# Find files implementing a use case
mcp-tool find_usecase_files \
  --projectId proj-123 \
  --useCaseKey UC-AUTH-001

# Manually create mapping
mcp-tool update_file_mappings \
  --projectId proj-123 \
  --filePath backend/src/auth/login.service.ts \
  --useCaseKeys UC-AUTH-001,UC-AUTH-002 \
  --source MANUAL
```

### REST API

```bash
# Get affected use cases
curl "http://localhost:3000/api/impact-analysis/files-to-usecases?projectId=proj-123&filePaths=backend/src/auth/login.service.ts"

# Get implementing files
curl "http://localhost:3000/api/impact-analysis/usecase-to-files?projectId=proj-123&useCaseKey=UC-AUTH-001"

# Batch analysis
curl -X POST http://localhost:3000/api/impact-analysis/batch \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj-123",
    "filePaths": ["backend/src/auth/login.service.ts", "backend/src/auth/auth.guard.ts"]
  }'
```

## Next Steps

### Required Before Use

1. **Create Database Migration**
   ```bash
   cd backend
   npx prisma migrate dev --name add_file_usecase_mapping
   ```

2. **Run Migration**
   ```bash
   npx prisma migrate deploy
   ```

3. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```

4. **Restart Backend**
   ```bash
   npm run start:dev
   ```

### Optional Enhancements

1. **Historical Mapping Creation**
   - Run background job to create mappings from existing commits
   - Analyze all commits where story has use case links

2. **AI Inference**
   - Implement semantic search using embeddings
   - Use keyword matching for low-confidence suggestions
   - Run during code analysis background jobs

3. **Pattern Matching**
   - Define file path patterns per component
   - Auto-map files based on patterns
   - Store in project configuration

4. **Frontend Integration**
   - Show affected use cases in code quality dashboard
   - Display implementing files when viewing use case
   - Add impact analysis to PR workflow

5. **Notifications**
   - Alert use case owners when their files change
   - Send impact reports for high-risk PRs
   - Daily/weekly summaries

## Benefits

✅ **Automatic Discovery** - Mappings created automatically from commits
✅ **Rich Context** - Includes metrics, risk scores, test coverage
✅ **Multiple Access Points** - REST API, MCP tools, background jobs
✅ **Smart Confidence** - Different sources have different confidence levels
✅ **Temporal Tracking** - Knows when mappings were first/last seen
✅ **Occurrence Counting** - Confidence increases with repeated observations
✅ **Risk Assessment** - Automated risk calculation for impact analysis
✅ **Actionable Recommendations** - Suggests next steps based on analysis

## Architecture Alignment

This implementation aligns with the existing architecture:
- Uses Prisma ORM and PostgreSQL
- Follows NestJS module pattern
- Integrates with existing MCP tool structure
- Leverages existing CodeMetrics and Story models
- Extends commit tracking functionality
- Compatible with background worker system

## Files Changed/Created

### Created
- `backend/docs/FILE_TO_USECASE_MAPPING.md`
- `backend/src/impact-analysis/impact-analysis.service.ts`
- `backend/src/impact-analysis/impact-analysis.controller.ts`
- `backend/src/impact-analysis/impact-analysis.module.ts`
- `backend/src/mcp/servers/code-quality/analyze_file_impact.ts`
- `backend/src/mcp/servers/code-quality/find_usecase_files.ts`
- `backend/src/mcp/servers/code-quality/update_file_mappings.ts`
- `IMPLEMENTATION_SUMMARY.md` (this file)

### Modified
- `backend/prisma/schema.prisma` - Added FileUseCaseLink model and MappingSource enum
- `backend/src/mcp/servers/telemetry/link_commit.ts` - Added automatic mapping creation
- `backend/src/app.module.ts` - Registered ImpactAnalysisModule
