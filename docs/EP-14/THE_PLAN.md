# EP-14: File-Based Architecture & Guaranteed Delivery

Master planning document containing the architectural blueprint. All implementation stories in EP-14 reference this for context.

## Problem
MCP commands timeout because they make synchronous RemoteRunner calls to laptop-agent.

## Solution
Laptop-agent becomes the single upload path. Agents write files locally, laptop-agent watches and uploads via WebSocket with guaranteed delivery.

## Architecture
```
Agent writes → local files → Laptop-agent watches
                          → Persistent SQLite queue
                          → WebSocket upload → Backend
                          → ACK → Mark delivered
```

## Key Components

### 1. Persistent Queue (SQLite)
- Location: `~/.vibestudio/upload-queue.db`
- Schema: id, type, payload, status (pending/sent/acked), timestamps, retryCount
- Survives restarts, auto-resumes on reconnect
- **Max 10,000 items** (configurable) - fails loudly when limit reached
- **Retry timeout**: Items stuck in "sent" >30s get re-queued (max 5 retries)

### 2. File Watchers
- **ArtifactWatcher**: `docs/ST-XXX/*.md` → artifact:upload
- **TranscriptTailer**: `~/.claude/projects/**/*.jsonl` → transcript:upload
- **Initial sync option**: Process existing files on startup (configurable)

### 3. ACK Protocol
- Backend sends ACK with queueId after successful storage
- Laptop marks item as acked
- Deduplication via contentHash
- **Graceful error handling**: Invalid story/definition keys return error ACK, don't crash

### 4. Menu Bar App (Tauri - NOT Electron)
- **Why Tauri**: 5MB bundle vs 100MB, 10MB RAM vs 100MB, <1s startup
- Connection status (green/yellow/gray/red)
- Active sessions list (click to open transcript)
- Queue status (pending/sent/acked counts)
- **Sidecar pattern**: Node.js RemoteAgent runs as sidecar, Tauri provides UI shell
- **JSON-RPC over stdio**: Communication between Tauri and Node.js sidecar

### 5. Transcript Persistence
- **TranscriptLine model**: Store streamed lines in DB
- **Configurable retention**: `TRANSCRIPT_RETENTION_DAYS` in .env (default: 7)
- **Cleanup job**: Delete old lines daily

### 6. Session Start Hook
- **Workflow-only check**: Only verify laptop connectivity for workflow sessions
- Regular Claude Code sessions proceed without check
- Health endpoint on port 3002

## File Naming Convention
- Artifacts: `docs/ST-{number}/{ARTIFACT_KEY}.md`
- Example: `docs/ST-123/ARCH_DOC.md`, `docs/ST-123/BA_ANALYSIS.md`

## Implementation Tracks

### Track A - Persistent Queue (6 stories)
| Story | Title |
|-------|-------|
| ST-320 | [A-1] Create UploadQueue class with SQLite |
| ST-321 | [A-2] Create UploadManager orchestration |
| ST-345 | [A-3] Add retry timeout for stuck sent items |
| ST-346 | [A-4] Add queue size limits |
| ST-352 | [A-5] Add queue depth monitoring and alerting |
| ST-353 | [A-6] Add unit tests for UploadQueue |

### Track B - Artifact Pipeline (7 stories)
| Story | Title |
|-------|-------|
| ST-325 | [B-1] Create ArtifactWatcher class |
| ST-326 | [B-2] Backend: Create artifact.handler.ts |
| ST-327 | [B-3] Integrate ArtifactWatcher into RemoteAgent |
| ST-324 | [B-4] Backend: Add deduplication logic |
| ST-347 | [B-5] Handle unknown story/definition keys gracefully |
| ST-351 | [B-6] Add initial file sync on ArtifactWatcher startup |
| ST-354 | [B-7] Add integration test for ACK flow |

### Track C - Transcript Streaming (7 stories)
| Story | Title |
|-------|-------|
| ST-328 | [C-1] Add TranscriptLine Prisma model |
| ST-329 | [C-2] Backend: Save transcript lines to DB |
| ST-330 | [C-3] Update TranscriptTailer to use UploadManager |
| ST-331 | [C-4] Frontend: Load transcripts from DB + stream |
| ST-348 | [C-5] Add configurable TranscriptLine retention |
| ST-322 | [C-6] Add ACK event handling to RemoteAgent |
| ST-323 | [C-7] Backend: Add ACK responses to handlers |

### Track D - Menu Bar App / Tauri (10 stories)
| Story | Title |
|-------|-------|
| ST-350 | [D-1] Convert menu bar app from Electron to Tauri |
| ST-335 | [D-2] Setup Tauri project structure with Node.js sidecar |
| ST-336 | [D-3] Configure Tauri system tray with sidecar IPC |
| ST-337 | [D-4] Create Tauri invoke commands for frontend |
| ST-338 | [D-5] Build ConnectionStatus React component (Tauri) |
| ST-339 | [D-6] Build SessionList React component (Tauri) |
| ST-340 | [D-7] Build QueueStatus React component (Tauri) |
| ST-341 | [D-8] Build main App component with Tauri integration |
| ST-342 | [D-9] Add JSON-RPC interface to RemoteAgent for sidecar IPC |
| ST-343 | [D-10] Configure Tauri bundler for macOS distribution |

### Track E - Backend Decoupling (4 stories)
| Story | Title |
|-------|-------|
| ST-332 | [E-1] Remove RemoteRunner from advance_step |
| ST-333 | [E-2] Add laptop connectivity check to SessionStart hook |
| ST-334 | [E-3] Add health endpoint to laptop-agent |
| ST-349 | [E-4] Distinguish workflow vs regular sessions in hook |

### Track F - Component Updates (1 story)
| Story | Title |
|-------|-------|
| ST-344 | [F-1] Update component instructions for file-based artifacts |

### Track G - Epic Artifact Support (2 stories)
| Story | Title |
|-------|-------|
| ST-362 | [E-1] Add epic-level artifact support to schema and MCP tools |
| ST-363 | [E-2] Add epic file hierarchy and auto-move on epic assignment |

## Total Stories: 38 (1 master + 37 implementation)

## Success Criteria
- advance_step < 1s (no remote calls)
- Guaranteed delivery (survives restarts, retries stuck items)
- Real-time transcript streaming with persistence
- Menu bar app < 10MB bundle, < 15MB RAM
