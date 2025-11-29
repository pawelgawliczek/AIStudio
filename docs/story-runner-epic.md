# Story Runner Epic - Terminal First Approach

## Overview

Before implementing web GUI, implement all MCP commands, runner, and console interactions so that it's super convenient for users to do it terminal based first. When this is polished, we will design the GUI.

---

## 1. Designing the Kanban Flow

### Create Kanban Command
- Associate Kanban board to a team
- Each state has following parameters (wrapper on top of existing agent - proper implementation of Project Manager):

#### State Parameters

**Pre-execution instructions**
- To prepare context of an agent but will not be available in the agent's context
- This will be runner's context

**Mandatory artifacts**
- For the agent to operate on

**Agent instructions**
- Input instructions
- Execution instructions
- Output instructions
- Private context outside of runner's context

**Post-execution instructions**
- Post agent execution outside of agent context
- This will be runner's context

**Custom compact instructions for the runner**

**Configuration:**
- Requires approval after completion (human in the loop) - yes/no
- Allow to run in parallel
- Where to run (client of MCP, MCP server) - there can be a flow that part of work is done on client and part on server
- Security (inside / outside docker)

### Kanban Artifacts Management
- Define artifact structures
- Add architecture document to a kanban flow
- Mark artifacts as mandatory/read for agents

### Document Upload
- Upload documents/artifacts (designs, etc.) to the workflow
- Mark which agents will have access to it in context (selected/all/none)

---

## 2. Running the Story

### Story Assignment
- Assign a story to a kanban board
- Start execution of a story associated with kanban board
- Execute according to kanban rules

### Kanban Rules

**Runner (Claude Code Session)**
- Oversees the entire implementation
- Responsible for following the kanban rules
- Handled by a Claude Code session
- Runs on MCP server and orchestrates the execution

**Execution Flow:**
1. Runner runs pre-execution instructions to set the runner's context
2. Spawn agent with proper agent instructions in separate instance of Claude Code
3. After agent finishes, run post-execution instructions
4. Runner is sensitive to kanban state configuration:
   - Does it require human approval to move to next state?
   - Where to run it?
   - etc.

### Session Tracking & Telemetry
- Store session IDs (UUIDs) for runner and all agent sessions
- User can open Claude session with that session ID
- TOTAL telemetry of story interactions (runner and all agents) calculated perfectly
- Controlled environment means:
  - Clear log of execution
  - Agent interactions
  - Times of execution

---

## 3. Artifact Discussion

- Open a separate Claude Code session that will load the artifact
- Session knows the structure of the document
- Any updates made to the artifact can be saved with one command

---

## MVP Approach

1. **DB structures** - Create all necessary database models
2. **Define agents/flow in DB** - Start testing as soon as possible (even without easy modification via commands)
3. **Implementation order:**
   - DB first
   - DB configuration with kanban boards/states/agents
   - Runner implementation
   - Everything else
   - Web GUI at the very end
