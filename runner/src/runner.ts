/**
 * Main Runner Class (ST-200 Refactored)
 * Orchestrates workflow execution via WebSocket to laptop Master Session
 */

import { EventEmitter } from 'events';
import {
  RunnerConfig,
  RunnerCheckpoint,
  WorkflowState,
  WorkflowRun,
  StoryContext,
  MasterResponse,
  StateExecutionResult,
  createCheckpoint,
  // ST-147: Session telemetry
  addDecision,
  updateTurnCounts,
  TurnCounts,
} from './types';
import { WebSocketOrchestrator } from './websocket-orchestrator';
import { CheckpointService } from './checkpoint/checkpoint-service';
import { ResourceManager } from './resources/resource-manager';
import { BackendClient, Breakpoint, BreakpointContext, ApprovalRequest } from './api/backend-client';
import { ResponseHandler } from './state-machine/response-handler';
import { v4 as uuidv4 } from 'uuid';

/**
 * Runner state machine states
 */
export type RunnerState =
  | 'created'
  | 'initializing'
  | 'ready'
  | 'executing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Runner events
 */
export interface RunnerEvents {
  'state:changed': (state: RunnerState, previousState: RunnerState) => void;
  'state:executing': (stateId: string, stateName: string) => void;
  'state:completed': (result: StateExecutionResult) => void;
  'master:response': (response: MasterResponse) => void;
  'agent:spawned': (stateId: string, componentId: string) => void;
  'agent:completed': (stateId: string, exitCode: number) => void;
  'checkpoint:saved': (checkpoint: RunnerCheckpoint) => void;
  'breakpoint:hit': (breakpoint: Breakpoint, position: 'before' | 'after', stateId: string) => void;
  'approval:required': (approval: ApprovalRequest, stateId: string, stateName: string) => void;
  'error': (error: Error) => void;
}

/**
 * Options for starting a run
 */
export interface RunOptions {
  runId: string;
  workflowId: string;
  storyId?: string;
  triggeredBy: string;
}

/**
 * Story Runner
 * Orchestrates workflow execution using Master + Agent CLI architecture
 */
export class Runner extends EventEmitter {
  private state: RunnerState = 'created';
  private config: RunnerConfig;
  private checkpoint: RunnerCheckpoint | null = null;
  private orchestrator: WebSocketOrchestrator;
  private checkpointService: CheckpointService;
  private resourceManager: ResourceManager;
  private backendClient: BackendClient;
  private responseHandler: ResponseHandler;

  // Workflow context
  private workflowRun: WorkflowRun | null = null;
  private states: WorkflowState[] = [];
  private storyContext: StoryContext | null = null;
  private currentStateIndex: number = 0;

  // ST-146: Breakpoint state
  private breakpoints: Breakpoint[] = [];
  private breakpointsModifiedAt: string | null = null;
  private lastAgentOutput: Record<string, unknown> | undefined;

  // ST-148: Approval state
  private approvalFeedback: string | null = null;
  private shouldRerunCurrentState: boolean = false;

  // ST-200: Master session tracking
  private masterSessionId: string | null = null;
  private masterTranscriptPath: string | null = null;

  constructor(config: RunnerConfig) {
    super();
    this.config = config;
    this.checkpointService = new CheckpointService(config);
    this.resourceManager = new ResourceManager(config.limits);
    this.backendClient = new BackendClient(config.backendUrl);
    this.responseHandler = new ResponseHandler(this);

    // ST-200: Use provided orchestrator or create new one
    if (config.orchestrator) {
      this.orchestrator = config.orchestrator;
    } else {
      this.orchestrator = new WebSocketOrchestrator({
        serverUrl: config.backendUrl,
        apiKey: process.env.RUNNER_API_KEY || 'default-runner-key',
      });
    }
  }

  /**
   * Get current runner state
   */
  getState(): RunnerState {
    return this.state;
  }

  /**
   * Get current checkpoint
   */
  getCheckpoint(): RunnerCheckpoint | null {
    return this.checkpoint;
  }

  /**
   * Transition to a new state
   */
  private setState(newState: RunnerState): void {
    const previousState = this.state;
    this.state = newState;
    this.emit('state:changed', newState, previousState);
    console.log(`[Runner] State: ${previousState} → ${newState}`);
  }

  /**
   * Start a new workflow run
   */
  async start(options: RunOptions): Promise<void> {
    if (this.state !== 'created') {
      throw new Error(`Cannot start runner in state: ${this.state}`);
    }

    try {
      this.setState('initializing');

      // Load workflow and states from backend
      console.log(`[Runner] Loading workflow ${options.workflowId}...`);
      const workflow = await this.backendClient.getWorkflow(options.workflowId);
      this.states = workflow.states.sort((a, b) => a.order - b.order);

      if (this.states.length === 0) {
        throw new Error('Workflow has no states defined');
      }

      // Load story context if story-based run
      if (options.storyId) {
        console.log(`[Runner] Loading story ${options.storyId}...`);
        this.storyContext = await this.backendClient.getStory(options.storyId);
      }

      // Get or create workflow run
      console.log(`[Runner] Loading workflow run ${options.runId}...`);
      this.workflowRun = await this.backendClient.getWorkflowRun(options.runId);

      // Initialize checkpoint
      this.masterSessionId = `master-${options.runId}`;
      this.checkpoint = createCheckpoint(
        options.runId,
        options.workflowId,
        this.masterSessionId,
        options.storyId
      );
      this.checkpoint.currentStateId = this.states[0].id;

      // ST-200: Connect to WebSocket orchestrator
      console.log(`[Runner] Connecting to WebSocket orchestrator...`);
      await this.orchestrator.connect();

      // ST-200: Start master session on laptop via WebSocket
      console.log(`[Runner] Starting master session on laptop...`);
      const sessionMetadata = await this.orchestrator.startMasterSession({
        workflowRunId: options.runId,
        projectPath: this.config.workingDirectory,
        model: this.config.master.model || 'claude-sonnet-4-20250514',
        jobToken: `runner-${options.runId}`,
      });

      this.masterSessionId = sessionMetadata.sessionId;
      this.masterTranscriptPath = sessionMetadata.transcriptPath;

      // ST-147: Set runner transcript path
      this.checkpoint.telemetry.runnerTranscriptPath = this.masterTranscriptPath;

      console.log(`[Runner] Master session started: ${this.masterSessionId}`);
      console.log(`[Runner] Transcript path: ${this.masterTranscriptPath}`);

      // ST-189: Register master transcript with backend
      console.log(`[Runner] Registering master transcript: ${this.masterTranscriptPath}`);
      const masterRegResult = await this.backendClient.registerMasterTranscript({
        workflowRunId: options.runId,
        sessionId: this.masterSessionId,
        transcriptPath: this.masterTranscriptPath,
      });
      if (!masterRegResult.success) {
        console.warn(`[Runner] Master transcript registration failed: ${masterRegResult.error}`);
      }

      this.setState('ready');

      // Begin execution
      await this.execute();
    } catch (error) {
      console.error(`[Runner] Initialization failed:`, error);
      this.emit('error', error as Error);
      this.setState('failed');
      throw error;
    }
  }

  /**
   * Resume from a checkpoint
   */
  async resume(runId: string): Promise<void> {
    if (this.state !== 'created') {
      throw new Error(`Cannot resume runner in state: ${this.state}`);
    }

    try {
      this.setState('initializing');

      // Load checkpoint
      console.log(`[Runner] Loading checkpoint for run ${runId}...`);
      this.checkpoint = await this.checkpointService.load(runId);

      if (!this.checkpoint) {
        throw new Error(`No checkpoint found for run ${runId}`);
      }

      // Load workflow and states
      const workflow = await this.backendClient.getWorkflow(this.checkpoint.workflowId);
      this.states = workflow.states.sort((a, b) => a.order - b.order);

      // Find current state index
      this.currentStateIndex = this.states.findIndex(
        s => s.id === this.checkpoint!.currentStateId
      );
      if (this.currentStateIndex === -1) {
        throw new Error(`Checkpoint state ${this.checkpoint.currentStateId} not found in workflow`);
      }

      // Load story context if present
      if (this.checkpoint.storyId) {
        this.storyContext = await this.backendClient.getStory(this.checkpoint.storyId);
      }

      // Load workflow run
      this.workflowRun = await this.backendClient.getWorkflowRun(runId);

      // ST-148: Check for approval feedback on resume
      await this.checkApprovalFeedbackOnResume(runId);

      // ST-200: Connect to WebSocket orchestrator
      console.log(`[Runner] Connecting to WebSocket orchestrator...`);
      await this.orchestrator.connect();

      // ST-200: Resume master session on laptop via WebSocket
      console.log(`[Runner] Resuming master session ${this.checkpoint.masterSessionId}...`);
      const sessionMetadata = await this.orchestrator.resumeMasterSession({
        sessionId: this.checkpoint.masterSessionId,
        workflowRunId: runId,
        projectPath: this.config.workingDirectory,
        model: this.config.master.model || 'claude-sonnet-4-20250514',
      });

      this.masterSessionId = sessionMetadata.sessionId;
      this.masterTranscriptPath = sessionMetadata.transcriptPath;

      console.log(`[Runner] Master session resumed: ${this.masterSessionId}`);

      // Restore resource usage
      this.resourceManager.restore(this.checkpoint.resourceUsage);

      this.setState('ready');

      // Continue execution from checkpoint phase
      await this.execute();
    } catch (error) {
      console.error(`[Runner] Resume failed:`, error);
      this.emit('error', error as Error);
      this.setState('failed');
      throw error;
    }
  }

  /**
   * Check for approval feedback on resume
   * ST-148: Approval Gates
   */
  private async checkApprovalFeedbackOnResume(runId: string): Promise<void> {
    try {
      const latestApproval = await this.backendClient.getLatestApproval(runId);

      if (!latestApproval) {
        console.log(`[Runner] No approval found for run ${runId}`);
        return;
      }

      // Check if this was a rerun request with feedback
      if (
        latestApproval.status === 'approved' &&
        latestApproval.reExecutionMode === 'feedback_injection' &&
        latestApproval.feedback
      ) {
        console.log(`[Runner] Found approval feedback for rerun: ${latestApproval.feedback.substring(0, 100)}...`);
        this.approvalFeedback = latestApproval.feedback;
        this.shouldRerunCurrentState = true;

        // Remove current state from completed states (so it reruns)
        const currentStateId = this.checkpoint!.currentStateId;
        if (this.checkpoint!.completedStates.includes(currentStateId)) {
          this.checkpoint!.completedStates = this.checkpoint!.completedStates.filter(
            id => id !== currentStateId
          );
          console.log(`[Runner] Removed state ${currentStateId} from completed states for rerun`);
        }
      } else if (latestApproval.status === 'approved') {
        console.log(`[Runner] Approval approved, continuing to next state`);
        // Clear any previous feedback
        this.approvalFeedback = null;
        this.shouldRerunCurrentState = false;
      }
    } catch (error) {
      console.log(`[Runner] No approval feedback found:`, (error as Error).message);
      this.approvalFeedback = null;
      this.shouldRerunCurrentState = false;
    }
  }

  /**
   * Main execution loop
   * ST-146: Added breakpoint checks before and after each state
   */
  private async execute(): Promise<void> {
    if (this.state !== 'ready') {
      throw new Error(`Cannot execute in state: ${this.state}`);
    }

    this.setState('executing');

    try {
      // ST-146: Load breakpoints at start
      await this.loadBreakpoints();

      while (this.currentStateIndex < this.states.length) {
        // Check if paused (state can change via pause() method)
        if ((this.state as RunnerState) === 'paused') {
          console.log(`[Runner] Execution paused`);
          return;
        }

        // Check resource limits
        if (!this.resourceManager.canContinue()) {
          console.log(`[Runner] Resource limits exceeded`);
          await this.pause('Resource limits exceeded');
          return;
        }

        const currentState = this.states[this.currentStateIndex];
        console.log(`[Runner] Executing state ${this.currentStateIndex + 1}/${this.states.length}: ${currentState.name}`);

        // ST-146: Check breakpoint BEFORE state execution
        const beforeCheck = await this.checkBreakpoint(currentState.id, 'before');
        if (beforeCheck.shouldPause && beforeCheck.breakpoint) {
          console.log(`[Runner] Breakpoint hit: before ${currentState.name}`);
          this.emit('breakpoint:hit', beforeCheck.breakpoint, 'before', currentState.id);
          await this.pauseForBreakpoint(beforeCheck.breakpoint, 'before', currentState.name);
          return;
        }

        // Execute the state
        const result = await this.executeState(currentState);

        // Store last agent output for breakpoint conditions
        this.lastAgentOutput = result.output as Record<string, unknown> | undefined;

        if (!result.success && !result.skipped) {
          // Handle failure based on component's onFailure config
          const component = currentState.component;
          const onFailure = component?.onFailure || 'stop';

          if (onFailure === 'stop') {
            throw new Error(`State ${currentState.name} failed: ${result.error}`);
          } else if (onFailure === 'pause') {
            await this.pause(`State ${currentState.name} failed: ${result.error}`);
            return;
          }
          // 'skip' and 'retry' are handled in executeState
        }

        // ST-146: Check breakpoint AFTER state execution
        const afterCheck = await this.checkBreakpoint(currentState.id, 'after');
        if (afterCheck.shouldPause && afterCheck.breakpoint) {
          console.log(`[Runner] Breakpoint hit: after ${currentState.name}`);
          this.emit('breakpoint:hit', afterCheck.breakpoint, 'after', currentState.id);
          await this.pauseForBreakpoint(afterCheck.breakpoint, 'after', currentState.name);
          return;
        }

        // ST-148: Check approval gate (handles requiresApproval flag + per-run overrides)
        if (result.success && !result.skipped) {
          const shouldPause = await this.checkApprovalGate(currentState, result);
          if (shouldPause) {
            return;
          }
        }

        // Save checkpoint after each state
        await this.saveCheckpoint();

        // Move to next state
        this.currentStateIndex++;
        this.resourceManager.recordStateTransition();
      }

      // All states completed
      console.log(`[Runner] All states completed successfully`);
      await this.complete();
    } catch (error) {
      console.error(`[Runner] Execution failed:`, error);
      this.emit('error', error as Error);
      this.setState('failed');
      await this.backendClient.updateWorkflowRun(this.workflowRun!.id, {
        status: 'failed',
        errorMessage: (error as Error).message,
      });
    }
  }

  /**
   * Load breakpoints from backend
   * ST-146: Breakpoint System
   */
  private async loadBreakpoints(): Promise<void> {
    if (!this.workflowRun) return;

    try {
      const response = await this.backendClient.getBreakpoints(this.workflowRun.id);
      this.breakpoints = response.breakpoints;
      this.breakpointsModifiedAt = response.breakpointsModifiedAt || null;
      console.log(`[Runner] Loaded ${this.breakpoints.length} breakpoints`);
    } catch (error) {
      console.log(`[Runner] No breakpoints or error loading:`, (error as Error).message);
      this.breakpoints = [];
    }
  }

  /**
   * Sync breakpoints if modified externally
   * ST-146: Breakpoint System
   */
  private async syncBreakpointsIfNeeded(): Promise<void> {
    if (!this.workflowRun) return;

    try {
      const response = await this.backendClient.getBreakpoints(this.workflowRun.id);
      if (response.breakpointsModifiedAt !== this.breakpointsModifiedAt) {
        this.breakpoints = response.breakpoints;
        this.breakpointsModifiedAt = response.breakpointsModifiedAt || null;
        console.log(`[Runner] Breakpoints synced, now ${this.breakpoints.length} active`);
      }
    } catch (error) {
      // Ignore sync errors, use cached breakpoints
    }
  }

  /**
   * Check if should pause at breakpoint
   * ST-146: Breakpoint System
   */
  private async checkBreakpoint(
    stateId: string,
    position: 'before' | 'after'
  ): Promise<{ shouldPause: boolean; breakpoint?: Breakpoint }> {
    // Sync breakpoints before checking
    await this.syncBreakpointsIfNeeded();

    // Find matching breakpoint
    const breakpoint = this.breakpoints.find(
      bp => bp.stateId === stateId && bp.position === position && bp.isActive
    );

    if (!breakpoint) {
      return { shouldPause: false };
    }

    // If conditional breakpoint, call backend to evaluate
    if (breakpoint.condition) {
      const context = this.buildBreakpointContext();
      const result = await this.backendClient.checkBreakpoint(
        this.workflowRun!.id,
        stateId,
        position,
        context
      );
      return result;
    }

    // Unconditional breakpoint
    return { shouldPause: true, breakpoint };
  }

  /**
   * Build context for breakpoint condition evaluation
   * ST-146: Breakpoint System
   */
  private buildBreakpointContext(): BreakpointContext {
    const usage = this.resourceManager.getUsage();
    return {
      tokensUsed: usage.tokensUsed,
      agentSpawns: usage.agentSpawns,
      stateTransitions: usage.stateTransitions,
      durationMs: usage.durationMs,
      currentStateIndex: this.currentStateIndex,
      totalStates: this.states.length,
      previousStateOutput: this.lastAgentOutput,
    };
  }

  /**
   * Pause execution due to breakpoint
   * ST-146: Breakpoint System
   */
  private async pauseForBreakpoint(
    breakpoint: Breakpoint,
    position: 'before' | 'after',
    stateName: string
  ): Promise<void> {
    const reason = breakpoint.condition
      ? `Conditional breakpoint hit ${position} ${stateName}`
      : `Breakpoint hit ${position} ${stateName}`;

    console.log(`[Runner] ${reason}`);

    // Record breakpoint hit in backend
    try {
      await this.backendClient.recordBreakpointHit(
        breakpoint.id,
        this.buildBreakpointContext()
      );
    } catch (error) {
      console.warn(`[Runner] Failed to record breakpoint hit:`, (error as Error).message);
    }

    // Pause execution
    await this.pause(reason);
  }

  /**
   * Check approval gate for a state
   * ST-148: Approval Gates
   * Returns true if runner should pause, false to continue
   */
  private async checkApprovalGate(
    state: WorkflowState,
    result: StateExecutionResult
  ): Promise<boolean> {
    if (!this.workflowRun) return false;

    // ST-148: Check for approval overrides in workflow run metadata
    const metadata = (this.workflowRun as any).metadata || {};
    const approvalOverrides = metadata._approvalOverrides || { mode: 'default' };

    // Determine if approval is required based on overrides
    let requiresApproval = state.requiresApproval;

    if (approvalOverrides.mode === 'none') {
      console.log(`[Runner] Approval override: mode='none', skipping approval for ${state.name}`);
      return false;
    } else if (approvalOverrides.mode === 'all') {
      console.log(`[Runner] Approval override: mode='all', requiring approval for ${state.name}`);
      requiresApproval = true;
    } else if (approvalOverrides.stateOverrides && approvalOverrides.stateOverrides[state.name] !== undefined) {
      requiresApproval = approvalOverrides.stateOverrides[state.name];
      console.log(`[Runner] Approval override: stateOverride for ${state.name} = ${requiresApproval}`);
    }

    if (!requiresApproval) {
      return false;
    }

    try {
      // Get project ID from workflow run
      const projectId = (this.workflowRun as any).projectId;
      if (!projectId) {
        console.warn(`[Runner] Cannot create approval request: no project ID`);
        return false;
      }

      // Create approval request
      const approval = await this.backendClient.createApprovalRequest({
        workflowRunId: this.workflowRun.id,
        stateId: state.id,
        projectId,
        stateName: state.name,
        stateOrder: state.order,
        requestedBy: 'story-runner',
        contextSummary: result.output ? JSON.stringify(result.output).substring(0, 500) : undefined,
        tokensUsed: result.tokensUsed,
      });

      console.log(`[Runner] Created approval request: ${approval.id}`);
      this.emit('approval:required', approval, state.id, state.name);

      // Pause for approval
      await this.pause(`Approval required after ${state.name}`);
      return true;
    } catch (error) {
      console.error(`[Runner] Failed to create approval request:`, (error as Error).message);
      // On error, continue without approval (fallback behavior)
      return false;
    }
  }

  /**
   * Execute a single state
   */
  private async executeState(state: WorkflowState): Promise<StateExecutionResult> {
    const startTime = Date.now();
    this.emit('state:executing', state.id, state.name);

    // Update checkpoint
    this.checkpoint!.currentStateId = state.id;

    try {
      // 1. Execute pre-execution instructions (if any)
      if (state.preExecutionInstructions) {
        this.checkpoint!.currentPhase = 'pre';
        await this.saveCheckpoint();

        console.log(`[Runner] Executing pre-instructions for ${state.name}`);
        const preResponse = await this.executeMasterInstruction(
          'pre',
          state,
          state.preExecutionInstructions
        );
        this.emit('master:response', preResponse);

        // Handle pre-execution response
        const preAction = await this.responseHandler.handle(preResponse, state);
        if (preAction === 'skip') {
          return {
            stateId: state.id,
            success: true,
            skipped: true,
            durationMs: Date.now() - startTime,
            tokensUsed: preResponse.meta?.tokensUsed || 0,
          };
        }
        if (preAction === 'pause' || preAction === 'stop') {
          return {
            stateId: state.id,
            success: preAction === 'stop',
            skipped: false,
            durationMs: Date.now() - startTime,
            tokensUsed: preResponse.meta?.tokensUsed || 0,
          };
        }
      }

      // 2. Spawn agent for state (if component exists)
      let agentOutput: unknown;
      let agentTokens = 0;
      let componentRunId: string | undefined;

      if (state.componentId && state.component) {
        this.checkpoint!.currentPhase = 'agent';
        await this.saveCheckpoint();

        console.log(`[Runner] Spawning agent for ${state.component.name}`);
        const agentResult = await this.spawnAgent(state);
        agentOutput = agentResult.output;
        agentTokens = agentResult.tokensUsed;
        componentRunId = agentResult.componentRunId;

        if (!agentResult.success) {
          return {
            stateId: state.id,
            success: false,
            skipped: false,
            componentRunId,
            error: agentResult.error,
            durationMs: Date.now() - startTime,
            tokensUsed: agentTokens,
          };
        }
      }

      // 3. Execute post-execution instructions (if any)
      if (state.postExecutionInstructions) {
        this.checkpoint!.currentPhase = 'post';
        await this.saveCheckpoint();

        console.log(`[Runner] Executing post-instructions for ${state.name}`);
        const postResponse = await this.executeMasterInstruction(
          'post',
          state,
          state.postExecutionInstructions,
          agentOutput
        );
        this.emit('master:response', postResponse);

        // Handle post-execution response
        await this.responseHandler.handle(postResponse, state);
      }

      // Mark state as completed
      this.checkpoint!.completedStates.push(state.id);

      // ST-147: Log state_transition decision
      addDecision(this.checkpoint!.telemetry, {
        stateId: state.id,
        stateName: state.name,
        decisionType: 'state_transition',
        reason: `State ${state.name} completed successfully`,
        outcome: 'success',
        metadata: {
          componentId: componentRunId,
          tokensUsed: agentTokens,
          durationMs: Date.now() - startTime,
        },
      });

      return {
        stateId: state.id,
        success: true,
        skipped: false,
        componentRunId,
        output: agentOutput,
        durationMs: Date.now() - startTime,
        tokensUsed: agentTokens,
      };
    } catch (error) {
      // ST-147: Log failed state_transition decision
      addDecision(this.checkpoint!.telemetry, {
        stateId: state.id,
        stateName: state.name,
        decisionType: 'state_transition',
        reason: `State ${state.name} failed`,
        outcome: 'failed',
        metadata: {
          errorMessage: (error as Error).message,
          durationMs: Date.now() - startTime,
        },
      });

      return {
        stateId: state.id,
        success: false,
        skipped: false,
        error: (error as Error).message,
        durationMs: Date.now() - startTime,
        tokensUsed: 0,
      };
    }
  }

  /**
   * Execute instruction in master session (ST-200: via WebSocket)
   */
  private async executeMasterInstruction(
    phase: 'pre' | 'post',
    state: WorkflowState,
    instructions: string,
    agentOutput?: unknown
  ): Promise<MasterResponse> {
    if (!this.masterSessionId || !this.workflowRun) {
      throw new Error('Master session not initialized');
    }

    const context = this.buildContext(state, phase, agentOutput);
    const prompt = this.buildMasterPrompt(phase, state, instructions, context);

    // ST-200: Generate nonce for response validation
    const nonce = uuidv4();

    // ST-200: Send command via WebSocket
    const result = await this.orchestrator.sendCommand({
      workflowRunId: this.workflowRun.id,
      command: prompt,
      nonce,
    });

    // Parse the response into MasterResponse format
    // The output should contain a JSON block with the response
    return this.parseMasterResponse(result.output);
  }

  /**
   * Parse Master Session output into MasterResponse (ST-200)
   */
  private parseMasterResponse(output: string): MasterResponse {
    // Try to extract JSON block from output
    const jsonMatch = output.match(/```json:master-response\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        return {
          action: parsed.action || 'proceed',
          status: parsed.status || 'success',
          message: parsed.message || '',
          output: parsed.output,
          control: parsed.control,
        };
      } catch (error) {
        console.warn('[Runner] Failed to parse master response JSON:', error);
      }
    }

    // Fallback: return a default "proceed" response
    return {
      action: 'proceed',
      status: 'success',
      message: output.substring(0, 200),
      output: {
        stateOutput: output,
      },
    };
  }

  /**
   * Spawn agent for a state (ST-200: via Task tool in Master Session)
   */
  private async spawnAgent(
    state: WorkflowState
  ): Promise<{
    success: boolean;
    output?: unknown;
    error?: string;
    tokensUsed: number;
    componentRunId?: string;
  }> {
    if (!state.component) {
      throw new Error(`State ${state.name} has no component`);
    }

    // Check resource limits
    if (!this.resourceManager.canSpawnAgent()) {
      return {
        success: false,
        error: 'Agent spawn limit exceeded',
        tokensUsed: 0,
      };
    }

    // Record agent spawn in backend
    const componentRun = await this.backendClient.recordAgentStart({
      workflowRunId: this.workflowRun!.id,
      componentId: state.componentId!,
    });

    this.emit('agent:spawned', state.id, state.componentId!);

    // ST-147: Log agent_spawn decision
    addDecision(this.checkpoint!.telemetry, {
      stateId: state.id,
      stateName: state.name,
      decisionType: 'agent_spawn',
      reason: `Spawning agent ${state.component.name} for state ${state.name}`,
      outcome: 'pending',
      metadata: {
        componentId: state.componentId!,
      },
    });

    try {
      // ST-200: Build agent prompt with component instructions
      const agentPrompt = this.buildAgentPrompt(state);

      // ST-200: Build Task tool command for Master Session
      const taskCommand = `Use the Task tool to spawn a component agent with these instructions:

Component: ${state.component.name}
Component ID: ${state.componentId}
State ID: ${state.id}

${agentPrompt}

IMPORTANT: After the agent completes, extract the output and respond with it in your master-response JSON block.`;

      // ST-200: Send agent spawn command via WebSocket
      const nonce = uuidv4();
      const result = await this.orchestrator.sendCommand({
        workflowRunId: this.workflowRun!.id,
        command: taskCommand,
        nonce,
      });

      // Parse the agent output from Master Session response
      const masterResponse = this.parseMasterResponse(result.output);

      this.emit('agent:completed', state.id, 0);
      this.resourceManager.recordAgentSpawn();

      // Estimate token usage (will be tracked via transcripts)
      const estimatedTokens = (result.metrics?.inputTokens || 0) + (result.metrics?.outputTokens || 0);
      this.resourceManager.recordTokens(estimatedTokens);

      // Record completion in backend
      await this.backendClient.recordAgentComplete({
        componentRunId: componentRun.id,
        success: masterResponse.status === 'success',
        output: masterResponse.output,
        errorMessage: masterResponse.status === 'error' ? masterResponse.message : undefined,
        tokensInput: result.metrics?.inputTokens,
        tokensOutput: result.metrics?.outputTokens,
      });

      return {
        success: masterResponse.status === 'success',
        output: masterResponse.output,
        error: masterResponse.status === 'error' ? masterResponse.message : undefined,
        tokensUsed: estimatedTokens,
        componentRunId: componentRun.id,
      };
    } catch (error) {
      await this.backendClient.recordAgentComplete({
        componentRunId: componentRun.id,
        success: false,
        errorMessage: (error as Error).message,
      });

      return {
        success: false,
        error: (error as Error).message,
        tokensUsed: 0,
        componentRunId: componentRun.id,
      };
    }
  }

  /**
   * Build context for master instructions
   */
  private buildContext(
    state: WorkflowState,
    phase: 'pre' | 'post',
    agentOutput?: unknown
  ): Record<string, unknown> {
    return {
      workflow: {
        id: this.checkpoint!.workflowId,
        currentState: state.name,
        currentStateIndex: this.currentStateIndex,
        totalStates: this.states.length,
        completedStates: this.checkpoint!.completedStates,
      },
      story: this.storyContext,
      state: {
        id: state.id,
        name: state.name,
        component: state.component?.name,
        mandatory: state.mandatory,
      },
      phase,
      agentOutput,
      resourceUsage: this.resourceManager.getUsage(),
    };
  }

  /**
   * Build prompt for master session
   */
  private buildMasterPrompt(
    phase: 'pre' | 'post',
    state: WorkflowState,
    instructions: string,
    context: Record<string, unknown>
  ): string {
    return `
You are executing ${phase}-execution instructions for state "${state.name}".

## Instructions
${instructions}

## Context
${JSON.stringify(context, null, 2)}

## CRITICAL: Response Format
After completing the instructions, you MUST output a JSON response block:

\`\`\`json:master-response
{
  "action": "proceed|spawn_agent|pause|stop|retry|skip|wait|rerun_state",
  "status": "success|error|warning|info",
  "message": "What you did and why",
  "output": { ... },
  "control": { ... }
}
\`\`\`

This response tells the Runner what to do next.
`;
  }

  /**
   * Build prompt for agent session
   */
  private buildAgentPrompt(state: WorkflowState): string {
    const component = state.component!;

    let prompt = `You are the ${component.name} agent.

## Input Instructions
${component.inputInstructions}

## Operation Instructions
${component.operationInstructions}

## Output Instructions
${component.outputInstructions}
`;

    if (this.storyContext) {
      prompt += `
## Story Context
Story: ${this.storyContext.key} - ${this.storyContext.title}
Type: ${this.storyContext.type}
Description: ${this.storyContext.description || 'N/A'}
`;

      if (this.storyContext.architectAnalysis) {
        prompt += `\n### Architect Analysis\n${this.storyContext.architectAnalysis}\n`;
      }
      if (this.storyContext.baAnalysis) {
        prompt += `\n### BA Analysis\n${this.storyContext.baAnalysis}\n`;
      }
    }

    // ST-148: Inject approval feedback if this is a rerun
    if (this.approvalFeedback && this.shouldRerunCurrentState) {
      prompt += `
## ⚠️ IMPORTANT: Rerun with Feedback
This state is being re-executed based on human review feedback.
**You MUST address the following feedback:**

${this.approvalFeedback}

Please carefully review the feedback above and ensure your output addresses all concerns.
`;
      // Clear feedback after injecting (so it doesn't repeat on next state)
      this.approvalFeedback = null;
      this.shouldRerunCurrentState = false;
    }

    prompt += `\nBegin execution now.`;

    return prompt;
  }

  /**
   * Save checkpoint to DB and file
   */
  private async saveCheckpoint(): Promise<void> {
    if (!this.checkpoint) return;

    this.checkpoint.resourceUsage = this.resourceManager.getUsage();
    this.checkpoint.checkpointedAt = new Date().toISOString();

    await this.checkpointService.save(this.checkpoint);
    this.emit('checkpoint:saved', this.checkpoint);
  }

  /**
   * Pause execution
   */
  async pause(reason?: string): Promise<void> {
    if (this.state !== 'executing') {
      console.log(`[Runner] Cannot pause in state: ${this.state}`);
      return;
    }

    console.log(`[Runner] Pausing: ${reason || 'Manual pause'}`);
    this.setState('paused');

    // ST-147: Log pause decision
    const currentState = this.states[this.currentStateIndex];
    if (currentState && this.checkpoint) {
      addDecision(this.checkpoint.telemetry, {
        stateId: currentState.id,
        stateName: currentState.name,
        decisionType: 'pause',
        reason: reason || 'Manual pause',
        outcome: 'success',
      });
    }

    if (this.workflowRun) {
      await this.backendClient.updateWorkflowRun(this.workflowRun.id, {
        status: 'paused',
        isPaused: true,
        pauseReason: reason,
      });
    }

    await this.saveCheckpoint();
  }

  /**
   * Resume execution after pause
   */
  async unpause(): Promise<void> {
    if (this.state !== 'paused') {
      throw new Error(`Cannot resume in state: ${this.state}`);
    }

    console.log(`[Runner] Resuming execution`);

    if (this.workflowRun) {
      await this.backendClient.updateWorkflowRun(this.workflowRun.id, {
        status: 'running',
        isPaused: false,
        pauseReason: null,
      });
    }

    this.setState('ready');
    await this.execute();
  }

  /**
   * Complete the workflow run (ST-200: stop Master Session via WebSocket)
   */
  private async complete(): Promise<void> {
    console.log(`[Runner] Completing workflow run`);
    this.setState('completed');

    // ST-200: Stop Master Session on laptop via WebSocket
    if (this.masterSessionId && this.workflowRun) {
      try {
        await this.orchestrator.stopMasterSession(this.workflowRun.id, {
          timeoutMs: 5000,
          forceKill: false,
        });
        console.log(`[Runner] Master session stopped gracefully`);
      } catch (error) {
        console.warn(`[Runner] Failed to stop master session:`, (error as Error).message);
      }
    }

    // Disconnect from WebSocket
    await this.orchestrator.disconnect();

    if (this.workflowRun) {
      await this.backendClient.updateWorkflowRun(this.workflowRun.id, {
        status: 'completed',
      });
    }

    await this.saveCheckpoint();
  }

  /**
   * Cancel the workflow run (ST-200: force kill Master Session)
   */
  async cancel(): Promise<void> {
    console.log(`[Runner] Cancelling workflow run`);
    this.setState('cancelled');

    // ST-200: Force kill Master Session on laptop via WebSocket
    if (this.masterSessionId && this.workflowRun) {
      try {
        await this.orchestrator.stopMasterSession(this.workflowRun.id, {
          timeoutMs: 2000,
          forceKill: true,
        });
        console.log(`[Runner] Master session killed`);
      } catch (error) {
        console.warn(`[Runner] Failed to kill master session:`, (error as Error).message);
      }
    }

    // Disconnect from WebSocket
    await this.orchestrator.disconnect();

    if (this.workflowRun) {
      await this.backendClient.updateWorkflowRun(this.workflowRun.id, {
        status: 'cancelled',
      });
    }

    await this.saveCheckpoint();
  }

  /**
   * Skip to a specific state
   */
  async skipToState(stateId: string): Promise<void> {
    const stateIndex = this.states.findIndex(s => s.id === stateId);
    if (stateIndex === -1) {
      throw new Error(`State ${stateId} not found`);
    }

    console.log(`[Runner] Skipping to state: ${this.states[stateIndex].name}`);
    this.currentStateIndex = stateIndex;
  }

  /**
   * Rerun a previous state
   */
  async rerunState(stateId: string): Promise<void> {
    const stateIndex = this.states.findIndex(s => s.id === stateId);
    if (stateIndex === -1) {
      throw new Error(`State ${stateId} not found`);
    }

    console.log(`[Runner] Rerunning state: ${this.states[stateIndex].name}`);

    // Remove from completed states
    this.checkpoint!.completedStates = this.checkpoint!.completedStates.filter(
      id => id !== stateId
    );

    this.currentStateIndex = stateIndex;
  }
}
