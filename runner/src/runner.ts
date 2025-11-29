/**
 * Main Runner Class
 * Orchestrates workflow execution using Claude Code CLI sessions
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
} from './types';
import { MasterSession } from './cli/master-session';
import { AgentSession } from './cli/agent-session';
import { CheckpointService } from './checkpoint/checkpoint-service';
import { ResourceManager } from './resources/resource-manager';
import { BackendClient } from './api/backend-client';
import { ResponseHandler } from './state-machine/response-handler';

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
  private masterSession: MasterSession | null = null;
  private checkpointService: CheckpointService;
  private resourceManager: ResourceManager;
  private backendClient: BackendClient;
  private responseHandler: ResponseHandler;

  // Workflow context
  private workflowRun: WorkflowRun | null = null;
  private states: WorkflowState[] = [];
  private storyContext: StoryContext | null = null;
  private currentStateIndex: number = 0;

  constructor(config: RunnerConfig) {
    super();
    this.config = config;
    this.checkpointService = new CheckpointService(config);
    this.resourceManager = new ResourceManager(config.limits);
    this.backendClient = new BackendClient(config.backendUrl);
    this.responseHandler = new ResponseHandler(this);
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
      const masterSessionId = `master-${options.runId}`;
      this.checkpoint = createCheckpoint(
        options.runId,
        options.workflowId,
        masterSessionId,
        options.storyId
      );
      this.checkpoint.currentStateId = this.states[0].id;

      // Start master session
      console.log(`[Runner] Starting master session...`);
      this.masterSession = new MasterSession({
        sessionId: masterSessionId,
        workingDirectory: this.config.workingDirectory,
        maxTurns: this.config.master.maxTurns,
        model: this.config.master.model,
      });
      await this.masterSession.start();

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

      // Resume master session
      console.log(`[Runner] Resuming master session ${this.checkpoint.masterSessionId}...`);
      this.masterSession = new MasterSession({
        sessionId: this.checkpoint.masterSessionId,
        workingDirectory: this.config.workingDirectory,
        maxTurns: this.config.master.maxTurns,
        model: this.config.master.model,
      });
      await this.masterSession.resume();

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
   * Main execution loop
   */
  private async execute(): Promise<void> {
    if (this.state !== 'ready') {
      throw new Error(`Cannot execute in state: ${this.state}`);
    }

    this.setState('executing');

    try {
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

        // Execute the state
        const result = await this.executeState(currentState);

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
   * Execute instruction in master session
   */
  private async executeMasterInstruction(
    phase: 'pre' | 'post',
    state: WorkflowState,
    instructions: string,
    agentOutput?: unknown
  ): Promise<MasterResponse> {
    if (!this.masterSession) {
      throw new Error('Master session not initialized');
    }

    const context = this.buildContext(state, phase, agentOutput);
    const prompt = this.buildMasterPrompt(phase, state, instructions, context);

    return await this.masterSession.execute(prompt);
  }

  /**
   * Spawn agent for a state
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

    try {
      // Create agent session
      const agent = new AgentSession({
        workingDirectory: this.config.workingDirectory,
        componentId: state.componentId!,
        stateId: state.id,
        maxTurns: state.component.config.maxRetries || this.config.agent.maxTurns,
        timeout: state.component.config.timeout || this.config.agent.timeout,
        model: state.component.config.modelId || this.config.agent.model,
        allowedTools: state.component.tools,
        storyContext: this.storyContext ? {
          storyId: this.storyContext.id,
          title: this.storyContext.title,
          description: this.storyContext.description,
        } : undefined,
      });

      // Build agent prompt
      const prompt = this.buildAgentPrompt(state);

      // Execute agent
      const result = await agent.execute(prompt);

      this.emit('agent:completed', state.id, result.exitCode || 0);
      this.resourceManager.recordAgentSpawn();
      this.resourceManager.recordTokens(result.metrics.totalTokens);

      // Record completion in backend
      await this.backendClient.recordAgentComplete({
        componentRunId: componentRun.id,
        success: result.success,
        output: result.output,
        errorMessage: result.error,
        tokensInput: result.metrics.inputTokens,
        tokensOutput: result.metrics.outputTokens,
      });

      return {
        success: result.success,
        output: result.output,
        error: result.error,
        tokensUsed: result.metrics.totalTokens,
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
   * Complete the workflow run
   */
  private async complete(): Promise<void> {
    console.log(`[Runner] Completing workflow run`);
    this.setState('completed');

    if (this.masterSession) {
      await this.masterSession.stop();
    }

    if (this.workflowRun) {
      await this.backendClient.updateWorkflowRun(this.workflowRun.id, {
        status: 'completed',
      });
    }

    await this.saveCheckpoint();
  }

  /**
   * Cancel the workflow run
   */
  async cancel(): Promise<void> {
    console.log(`[Runner] Cancelling workflow run`);
    this.setState('cancelled');

    if (this.masterSession) {
      await this.masterSession.stop();
    }

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
