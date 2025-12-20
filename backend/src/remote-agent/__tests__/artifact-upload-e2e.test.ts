/**
 * E2E Test for Artifact Upload Flow (ST-327)
 *
 * Tests the complete artifact upload flow against production backend:
 * 1. Connect to production WebSocket
 * 2. Register as agent
 * 3. Create test story
 * 4. Send artifact:upload event
 * 5. Verify artifact appears in database
 * 6. Verify ACK received
 * 7. Clean up test data
 *
 * Run: npx tsx backend/src/remote-agent/__tests__/artifact-upload-e2e.test.ts
 */

import { PrismaClient } from '@prisma/client';
import { io, Socket } from 'socket.io-client';

const PROD_URL = process.env.PROD_URL || 'https://vibestudio.example.com';
const AGENT_SECRET = process.env.AGENT_SECRET || '48d8a63b17f8283d2ccc33abd1d1d68f9eb79284b1ca0edeb754115ccd4dd090';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

interface TestContext {
  projectId?: string;
  storyId?: string;
  storyKey?: string;
  artifactId?: string;
}

const context: TestContext = {};

async function createTestStory(): Promise<void> {
  console.log('📝 Creating test story...');

  // Find or create test project
  let project = await prisma.project.findFirst({
    where: { name: 'E2E Test Project' },
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        name: 'E2E Test Project',
        description: 'Test project for E2E artifact tests',
      },
    });
  }

  context.projectId = project.id;

  // Create test story
  const timestamp = Date.now();
  const story = await prisma.story.create({
    data: {
      key: `ST-E2E-${timestamp}`,
      title: `E2E Test Story Artifact ${timestamp}`,
      projectId: project.id,
      type: 'feature',
      status: 'planning',
      createdById: '00000000-0000-0000-0000-000000000001', // System user
    },
  });

  context.storyId = story.id;
  context.storyKey = story.key;

  console.log(`  ✅ Created test story: ${story.key} (${story.id})`);
}

async function cleanupTestData(): Promise<void> {
  console.log('\n🧹 Cleaning up test data...');

  try {
    // Delete artifact
    if (context.artifactId) {
      await prisma.artifact.delete({
        where: { id: context.artifactId },
      });
      console.log(`  ✅ Deleted artifact ${context.artifactId}`);
    }

    // Delete story
    if (context.storyId) {
      await prisma.story.delete({
        where: { id: context.storyId },
      });
      console.log(`  ✅ Deleted story ${context.storyKey}`);
    }

    // Note: We don't delete the project as it may be used by other tests
  } catch (error) {
    console.error('  ⚠️ Cleanup error:', error);
  }
}

async function testArtifactUpload(): Promise<boolean> {
  console.log('🔌 Connecting to WebSocket...');

  return new Promise((resolve) => {
    const socket: Socket = io(`${PROD_URL}/remote-agent`, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 10000,
    });

    let connected = false;
    let registered = false;
    let agentId: string | null = null;
    const receivedAcks: any[] = [];

    socket.on('connect', async () => {
      console.log('  ✅ Connected to WebSocket');
      connected = true;

      // Register as agent
      console.log('  📝 Registering as agent...');
      socket.emit('agent:register', {
        secret: AGENT_SECRET,
        hostname: 'st327-e2e-test',
        capabilities: ['artifact:upload'],
        claudeCodeVersion: '1.0.0',
        config: {},
      });
    });

    socket.on('agent:registered', async (data: any) => {
      console.log('  ✅ Registered successfully');
      console.log(`  🆔 Agent ID: ${data.agentId}`);
      registered = true;
      agentId = data.agentId;

      console.log('\n📤 Sending artifact:upload event...');

      // Send artifact upload
      const artifactPayload = {
        agentId: data.agentId,
        items: [
          {
            queueId: 8001,
            storyKey: context.storyKey!,
            artifactKey: 'E2E_TEST_ARTIFACT',
            filePath: `/test/e2e/artifact-${Date.now()}.md`,
            content: `# E2E Test Artifact\n\nThis is a test artifact created at ${new Date().toISOString()}\n\nContent hash should be unique.`,
            contentType: 'text/markdown',
            timestamp: Date.now(),
          },
        ],
      };

      socket.emit('artifact:upload', artifactPayload);
      console.log('  ✅ Artifact upload sent');
    });

    // Listen for ACK
    socket.on('upload:ack:item', (data: any) => {
      console.log('  📨 Received upload:ack:item:', JSON.stringify(data));
      receivedAcks.push(data);
    });

    socket.on('connect_error', (error) => {
      console.error('  ❌ Connection error:', error.message);
      resolve(false);
    });

    socket.on('agent:error', (error) => {
      console.log('  ⚠️ Agent error:', JSON.stringify(error));
    });

    // Wait for responses then verify
    setTimeout(async () => {
      socket.disconnect();

      console.log('\n' + '═'.repeat(50));
      console.log('📊 TEST RESULTS');
      console.log('═'.repeat(50));

      let passed = true;
      const results: string[] = [];

      // Check connection
      if (connected) {
        results.push('✅ WebSocket connection: PASS');
      } else {
        results.push('❌ WebSocket connection: FAIL');
        passed = false;
      }

      // Check registration
      if (registered) {
        results.push('✅ Agent registration: PASS');
      } else {
        results.push('❌ Agent registration: FAIL');
        passed = false;
      }

      // Check ACK
      if (receivedAcks.length > 0) {
        const ack = receivedAcks[0];
        if (ack.success) {
          results.push('✅ ACK received with success=true');

          // Check database
          console.log('\n🔍 Checking database...');
          try {
            const artifacts = await prisma.artifact.findMany({
              where: {
                storyId: context.storyId,
              },
              orderBy: { createdAt: 'desc' },
            });

            if (artifacts.length > 0) {
              const artifact = artifacts[0];
              context.artifactId = artifact.id;

              results.push(`✅ Artifact found in database: ${artifact.id}`);
              results.push(`   - Content type: ${artifact.contentType}`);
              results.push(`   - Content length: ${artifact.content.length} chars`);

              // Verify content
              if (artifact.content.includes('E2E Test Artifact')) {
                results.push('✅ Artifact content verified');
              } else {
                results.push('❌ Artifact content incorrect');
                passed = false;
              }

              // Verify content type
              if (artifact.contentType === 'text/markdown') {
                results.push('✅ Content type correct (text/markdown)');
              } else {
                results.push(`❌ Content type incorrect: ${artifact.contentType}`);
                passed = false;
              }
            } else {
              results.push('❌ No artifact found in database');
              passed = false;
            }
          } catch (error: any) {
            results.push(`❌ Database check failed: ${error.message}`);
            passed = false;
          }
        } else {
          results.push(`❌ ACK received but success=false: ${ack.error}`);
          passed = false;
        }
      } else {
        results.push('❌ No ACK received');
        passed = false;
      }

      // Print results
      results.forEach(r => console.log(r));

      console.log('═'.repeat(50));
      if (passed) {
        console.log('🎉 ALL TESTS PASSED');
        console.log('Artifact upload flow is working correctly!');
      } else {
        console.log('💥 SOME TESTS FAILED');
      }
      console.log('═'.repeat(50) + '\n');

      resolve(passed);
    }, 5000);
  });
}

async function main(): Promise<void> {
  console.log('\n' + '═'.repeat(50));
  console.log('  ST-327 Artifact Upload - Production E2E Test');
  console.log('═'.repeat(50) + '\n');

  try {
    // Create test story
    await createTestStory();

    // Run test
    const passed = await testArtifactUpload();

    // Cleanup
    await cleanupTestData();

    // Disconnect from database
    await prisma.$disconnect();

    process.exit(passed ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    await cleanupTestData();
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
