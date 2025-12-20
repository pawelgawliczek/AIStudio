/**
 * ST-363: Epic Assignment Artifact Move E2E Test
 *
 * Tests the complete flow of artifact directory movement when a story is assigned to an epic:
 * 1. Create a test epic and story using MCP tools
 * 2. Create artifact file at docs/ST-XXX/THE_PLAN.md
 * 3. Assign story to epic via MCP update_story
 * 4. Backend sends artifact:move-request to laptop-agent
 * 5. Laptop-agent moves docs/ST-XXX/ → docs/EP-YYY/ST-XXX/
 * 6. Verify file exists at new location and removed from old
 * 7. Cleanup: delete story, epic, and any remaining files
 *
 * Prerequisites:
 * - Laptop-agent must be running and connected to backend
 * - Backend must be accessible at production URL
 * - Test must have valid AGENT_SECRET for WebSocket authentication
 *
 * Run: npm test -- epic-artifact-move.e2e
 */

import * as fs from 'fs';
import * as path from 'path';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';

// Production configuration
const PROD_URL = 'https://vibestudio.example.com';
const PROJECT_ID = '345a29ee-d6ab-477d-8079-c5dda0844d77'; // AI Studio
const AGENT_SECRET = process.env.AGENT_SECRET || '48d8a63b17f8283d2ccc33abd1d1d68f9eb79284b1ca0edeb754115ccd4dd090';
const PROJECT_PATH = '/Users/pawelgawliczek/projects/AIStudio';

// Test configuration
const TEST_TIMEOUT = 60000; // 60 seconds for E2E test with file operations

/**
 * REST API Client for making API calls
 * Uses actual REST endpoints instead of MCP HTTP endpoints
 */
class APIClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async login() {
    const response = await axios.post(
      `${this.baseUrl}/api/auth/login`,
      { email: 'admin@aistudio.local', password: 'admin123' },
      { headers: { 'Content-Type': 'application/json' } }
    );
    this.authToken = response.data.accessToken;
    return response.data;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
    };
  }

  async createEpic(data: { projectId: string; title: string; description?: string }) {
    const response = await axios.post(
      `${this.baseUrl}/api/epics`,
      data,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async createStory(data: {
    projectId: string;
    title: string;
    description?: string;
    epicId?: string;
  }) {
    const response = await axios.post(
      `${this.baseUrl}/api/stories`,
      data,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async updateStory(storyId: string, data: { epicId: string | null }) {
    const response = await axios.patch(
      `${this.baseUrl}/api/stories/${storyId}`,
      data,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async deleteStory(storyId: string) {
    const response = await axios.delete(
      `${this.baseUrl}/api/stories/${storyId}`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async deleteEpic(epicId: string) {
    const response = await axios.delete(
      `${this.baseUrl}/api/epics/${epicId}`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }
}

describe('Epic Assignment Artifact Move E2E (ST-363)', () => {
  let apiClient: APIClient;
  let socket: Socket;
  let testEpicId: string;
  let testEpicKey: string;
  let testStoryId: string;
  let testStoryKey: string;
  let agentId: string;

  beforeAll(async () => {
    console.log('\n🚀 Starting Epic Assignment Artifact Move E2E Test');
    console.log('=' .repeat(70));

    // Initialize API client and login
    apiClient = new APIClient(PROD_URL);
    await apiClient.login();
    console.log(`✅ API Client initialized and authenticated (${PROD_URL})`);

    // Connect to production WebSocket as agent
    console.log('🔌 Connecting to production WebSocket...');
    socket = io(`${PROD_URL}/remote-agent`, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 10000,
    });

    // Wait for connection and registration
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      socket.on('connect', () => {
        console.log('  ✅ Connected to WebSocket');
        clearTimeout(timeout);

        // Register as agent
        console.log('  📝 Registering as agent...');
        socket.emit('agent:register', {
          secret: AGENT_SECRET,
          hostname: 'epic-move-e2e-test',
          capabilities: ['artifact:move'],
          claudeCodeVersion: '1.0.0',
          config: { projectPath: PROJECT_PATH },
        });
      });

      socket.on('agent:registered', (data: { agentId: string }) => {
        console.log(`  ✅ Registered successfully (Agent ID: ${data.agentId})`);
        agentId = data.agentId;
        resolve();
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    console.log('✅ Setup complete\n');
  }, TEST_TIMEOUT);

  afterAll(async () => {
    console.log('\n🧹 Cleaning up...');

    // Cleanup files (if any remain)
    try {
      if (testStoryKey) {
        const possiblePaths = [
          path.join(PROJECT_PATH, 'docs', testStoryKey),
          path.join(PROJECT_PATH, 'docs', 'unassigned', testStoryKey),
        ];

        if (testEpicKey) {
          possiblePaths.push(path.join(PROJECT_PATH, 'docs', testEpicKey, testStoryKey));
        }

        for (const dirPath of possiblePaths) {
          if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
            console.log(`  🗑️  Removed directory: ${dirPath}`);
          }
        }
      }
    } catch (error) {
      console.warn('  ⚠️  Error cleaning up files:', error);
    }

    // Cleanup database entities
    try {
      if (testStoryId) {
        await apiClient.deleteStory(testStoryId);
        console.log(`  ✅ Deleted story: ${testStoryKey}`);
      }
    } catch (error) {
      console.warn('  ⚠️  Error deleting story:', error);
    }

    try {
      if (testEpicId) {
        await apiClient.deleteEpic(testEpicId);
        console.log(`  ✅ Deleted epic: ${testEpicKey}`);
      }
    } catch (error) {
      console.warn('  ⚠️  Error deleting epic:', error);
    }

    // Disconnect socket
    if (socket) {
      socket.disconnect();
      console.log('  ✅ Disconnected from WebSocket');
    }

    console.log('✅ Cleanup complete\n');
  }, TEST_TIMEOUT);

  it('should move artifact directory when story is assigned to epic', async () => {
    console.log('\n🧪 Test: Artifact directory move on epic assignment');
    console.log('-'.repeat(70));

    // Step 1: Create test epic
    console.log('\n📋 Step 1: Creating test epic...');
    const epicResponse = await apiClient.createEpic({
      projectId: PROJECT_ID,
      title: 'E2E Test Epic - Artifact Move',
      description: 'Test epic for ST-363 E2E test - will be deleted after test',
    });

    testEpicId = epicResponse.id;
    testEpicKey = epicResponse.key;
    console.log(`  ✅ Epic created: ${testEpicKey} (ID: ${testEpicId})`);

    // Step 2: Create test story (unassigned)
    console.log('\n📝 Step 2: Creating test story...');
    const storyResponse = await apiClient.createStory({
      projectId: PROJECT_ID,
      title: 'E2E Test Story - Artifact Move',
      description: 'Test story for ST-363 E2E test - will be deleted after test',
    });

    testStoryId = storyResponse.id;
    testStoryKey = storyResponse.key;
    console.log(`  ✅ Story created: ${testStoryKey} (ID: ${testStoryId})`);

    // Step 3: Create artifact file at docs/ST-XXX/THE_PLAN.md
    console.log('\n📄 Step 3: Creating artifact file...');
    const storyDirPath = path.join(PROJECT_PATH, 'docs', testStoryKey);
    const artifactPath = path.join(storyDirPath, 'THE_PLAN.md');

    fs.mkdirSync(storyDirPath, { recursive: true });
    fs.writeFileSync(
      artifactPath,
      `# ${testStoryKey} - Implementation Plan

## Overview
This is a test artifact created by ST-363 E2E test.

## Test Details
- Epic: ${testEpicKey}
- Story: ${testStoryKey}
- Timestamp: ${new Date().toISOString()}

## Expected Behavior
This file should be moved from docs/${testStoryKey}/ to docs/${testEpicKey}/${testStoryKey}/
when the story is assigned to the epic.
`
    );

    expect(fs.existsSync(artifactPath)).toBe(true);
    console.log(`  ✅ Artifact created: ${artifactPath}`);

    // Step 4: Setup move completion listener
    console.log('\n🎧 Step 4: Setting up move event listeners...');
    const moveEvents: Array<{ event: string; data: any }> = [];

    socket.on('artifact:move-complete', (data) => {
      console.log('  📨 Received artifact:move-complete:', JSON.stringify(data));
      moveEvents.push({ event: 'move-complete', data });
    });

    socket.on('artifact:move-failed', (data) => {
      console.log('  📨 Received artifact:move-failed:', JSON.stringify(data));
      moveEvents.push({ event: 'move-failed', data });
    });

    console.log('  ✅ Event listeners registered');

    // Step 5: Assign story to epic (triggers move)
    console.log('\n🔄 Step 5: Assigning story to epic...');
    await apiClient.updateStory(testStoryId, { epicId: testEpicId });
    console.log(`  ✅ Story ${testStoryKey} assigned to epic ${testEpicKey}`);

    // Step 6: Wait for move to complete
    console.log('\n⏳ Step 6: Waiting for artifact move...');
    const maxWaitMs = 15000; // 15 seconds
    const pollIntervalMs = 500;
    const startTime = Date.now();

    const newDirPath = path.join(PROJECT_PATH, 'docs', testEpicKey, testStoryKey);
    const newArtifactPath = path.join(newDirPath, 'THE_PLAN.md');

    let moved = false;
    while (Date.now() - startTime < maxWaitMs) {
      if (fs.existsSync(newArtifactPath) && !fs.existsSync(artifactPath)) {
        moved = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    expect(moved).toBe(true);
    console.log(`  ✅ Artifact moved to: ${newArtifactPath}`);

    // Step 7: Verify move completion event
    console.log('\n✅ Step 7: Verifying move completion event...');
    expect(moveEvents.length).toBeGreaterThan(0);

    const completionEvent = moveEvents.find(e => e.event === 'move-complete');
    expect(completionEvent).toBeDefined();
    expect(completionEvent?.data.storyKey).toBe(testStoryKey);
    expect(completionEvent?.data.success).toBe(true);
    console.log('  ✅ Move completion event received');

    // Step 8: Verify file exists at new location
    console.log('\n🔍 Step 8: Verifying file at new location...');
    expect(fs.existsSync(newArtifactPath)).toBe(true);

    const newContent = fs.readFileSync(newArtifactPath, 'utf-8');
    expect(newContent).toContain(testStoryKey);
    expect(newContent).toContain(testEpicKey);
    console.log('  ✅ File exists at new location with correct content');

    // Step 9: Verify file removed from old location
    console.log('\n🔍 Step 9: Verifying file removed from old location...');
    expect(fs.existsSync(artifactPath)).toBe(false);
    expect(fs.existsSync(storyDirPath)).toBe(false);
    console.log('  ✅ Old directory removed');

    console.log('\n✅ Test passed: Epic assignment artifact move completed successfully!');
    console.log('=' .repeat(70));
  }, TEST_TIMEOUT);

  it('should move artifact directory back to unassigned when epic is removed', async () => {
    console.log('\n🧪 Test: Artifact directory move on epic unassignment');
    console.log('-'.repeat(70));

    // Step 1: Create test epic
    console.log('\n📋 Step 1: Creating test epic...');
    const epicResponse = await apiClient.createEpic({
      projectId: PROJECT_ID,
      title: 'E2E Test Epic - Unassignment',
      description: 'Test epic for ST-363 unassignment E2E test',
    });

    const unassignEpicId = epicResponse.id;
    const unassignEpicKey = epicResponse.key;
    console.log(`  ✅ Epic created: ${unassignEpicKey}`);

    // Step 2: Create test story assigned to epic
    console.log('\n📝 Step 2: Creating test story with epic assignment...');
    const storyResponse = await apiClient.createStory({
      projectId: PROJECT_ID,
      title: 'E2E Test Story - Unassignment',
      description: 'Test story for ST-363 unassignment E2E test',
      epicId: unassignEpicId,
    });

    const unassignStoryId = storyResponse.id;
    const unassignStoryKey = storyResponse.key;
    console.log(`  ✅ Story created: ${unassignStoryKey} (assigned to ${unassignEpicKey})`);

    // Step 3: Create artifact file at epic location
    console.log('\n📄 Step 3: Creating artifact file in epic directory...');
    const epicDirPath = path.join(PROJECT_PATH, 'docs', unassignEpicKey, unassignStoryKey);
    const epicArtifactPath = path.join(epicDirPath, 'THE_PLAN.md');

    fs.mkdirSync(epicDirPath, { recursive: true });
    fs.writeFileSync(
      epicArtifactPath,
      `# ${unassignStoryKey} - Implementation Plan\n\nThis file should move to docs/unassigned/${unassignStoryKey}/ when epic is removed.`
    );

    expect(fs.existsSync(epicArtifactPath)).toBe(true);
    console.log(`  ✅ Artifact created: ${epicArtifactPath}`);

    // Step 4: Setup move listeners
    console.log('\n🎧 Step 4: Setting up move event listeners...');
    const moveEvents: Array<{ event: string; data: any }> = [];

    const moveCompleteHandler = (data: any) => {
      console.log('  📨 Received artifact:move-complete:', JSON.stringify(data));
      moveEvents.push({ event: 'move-complete', data });
    };

    const moveFailedHandler = (data: any) => {
      console.log('  📨 Received artifact:move-failed:', JSON.stringify(data));
      moveEvents.push({ event: 'move-failed', data });
    };

    socket.on('artifact:move-complete', moveCompleteHandler);
    socket.on('artifact:move-failed', moveFailedHandler);

    console.log('  ✅ Event listeners registered');

    // Step 5: Remove epic assignment (set epicId to null)
    console.log('\n🔄 Step 5: Removing epic assignment...');
    await apiClient.updateStory(unassignStoryId, { epicId: null });
    console.log(`  ✅ Story ${unassignStoryKey} unassigned from epic`);

    // Step 6: Wait for move to unassigned
    console.log('\n⏳ Step 6: Waiting for artifact move to unassigned...');
    const maxWaitMs = 15000;
    const pollIntervalMs = 500;
    const startTime = Date.now();

    const unassignedDirPath = path.join(PROJECT_PATH, 'docs', 'unassigned', unassignStoryKey);
    const unassignedArtifactPath = path.join(unassignedDirPath, 'THE_PLAN.md');

    let moved = false;
    while (Date.now() - startTime < maxWaitMs) {
      if (fs.existsSync(unassignedArtifactPath) && !fs.existsSync(epicArtifactPath)) {
        moved = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    expect(moved).toBe(true);
    console.log(`  ✅ Artifact moved to: ${unassignedArtifactPath}`);

    // Step 7: Verify move completion event
    console.log('\n✅ Step 7: Verifying move completion event...');
    expect(moveEvents.length).toBeGreaterThan(0);

    const completionEvent = moveEvents.find(e => e.event === 'move-complete');
    expect(completionEvent).toBeDefined();
    expect(completionEvent?.data.storyKey).toBe(unassignStoryKey);
    expect(completionEvent?.data.success).toBe(true);
    console.log('  ✅ Move completion event received');

    // Step 8: Verify file exists at unassigned location
    console.log('\n🔍 Step 8: Verifying file at unassigned location...');
    expect(fs.existsSync(unassignedArtifactPath)).toBe(true);
    console.log('  ✅ File exists at unassigned location');

    // Step 9: Verify file removed from epic location
    console.log('\n🔍 Step 9: Verifying file removed from epic location...');
    expect(fs.existsSync(epicArtifactPath)).toBe(false);
    expect(fs.existsSync(epicDirPath)).toBe(false);
    console.log('  ✅ Epic directory removed');

    // Cleanup
    console.log('\n🧹 Cleaning up test entities...');
    try {
      if (fs.existsSync(unassignedDirPath)) {
        fs.rmSync(unassignedDirPath, { recursive: true, force: true });
        console.log('  🗑️  Removed unassigned directory');
      }

      await apiClient.deleteStory(unassignStoryId);
      console.log(`  ✅ Deleted story: ${unassignStoryKey}`);

      await apiClient.deleteEpic(unassignEpicId);
      console.log(`  ✅ Deleted epic: ${unassignEpicKey}`);
    } catch (error) {
      console.warn('  ⚠️  Error during cleanup:', error);
    }

    // Remove listeners
    socket.off('artifact:move-complete', moveCompleteHandler);
    socket.off('artifact:move-failed', moveFailedHandler);

    console.log('\n✅ Test passed: Epic unassignment artifact move completed successfully!');
    console.log('=' .repeat(70));
  }, TEST_TIMEOUT);
});
