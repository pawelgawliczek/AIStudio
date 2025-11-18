import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function validateST28() {
  const runId = 'f7ba9955-eb8a-4fd2-b8c4-b97a2d43030e';

  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    select: {
      metadata: true,
      startedAt: true,
      finishedAt: true,
      status: true,
      coordinatorMetrics: true,
      totalTokensInput: true,
      totalTokensOutput: true,
      totalTokens: true,
      estimatedCost: true
    }
  });

  if (!run) {
    console.log('❌ Workflow run not found!');
    return;
  }

  console.log('=== ST-28 Workflow Run Validation ===');
  console.log('Run ID:', runId);
  console.log('Status:', run.status);
  console.log('Started:', run.startedAt.toISOString());
  console.log('Finished:', run.finishedAt?.toISOString() || 'Still running');
  console.log('');

  const metadata = run.metadata as any;
  const transcriptTracking = metadata?._transcriptTracking;

  console.log('=== Step 1: Transcript Tracking Initialization ===');
  if (transcriptTracking) {
    console.log('✅ _transcriptTracking exists in metadata');
    console.log('   Project Path:', transcriptTracking.projectPath);
    console.log('   Transcript Directory:', transcriptTracking.transcriptDirectory);
    console.log('   Orchestrator Transcript:', transcriptTracking.orchestratorTranscript || 'NOT SET');
    console.log('   Start Time:', transcriptTracking.orchestratorStartTime);
    console.log('   Existing Transcripts at Start:', transcriptTracking.existingTranscriptsAtStart?.length || 0);
  } else {
    console.log('❌ _transcriptTracking is MISSING from metadata');
    console.log('   This means start_workflow_run did NOT initialize tracking!');
    return;
  }

  // Check if transcript file exists
  const fs = require('fs');
  const path = require('path');

  if (transcriptTracking.transcriptDirectory && transcriptTracking.orchestratorTranscript) {
    const transcriptPath = path.join(
      transcriptTracking.transcriptDirectory,
      transcriptTracking.orchestratorTranscript
    );

    console.log('\n=== Step 2: Orchestrator Transcript File ===');
    console.log('Expected Path:', transcriptPath);

    if (fs.existsSync(transcriptPath)) {
      const stats = fs.statSync(transcriptPath);
      console.log('✅ Transcript file exists');
      console.log('   Size:', stats.size, 'bytes');
      console.log('   Modified:', stats.mtime.toISOString());

      // Read first few lines to verify format
      const content = fs.readFileSync(transcriptPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      console.log('   Total lines:', lines.length);

      if (lines.length > 0) {
        try {
          const firstEntry = JSON.parse(lines[0]);
          console.log('   Format: Valid JSON ✅');
          console.log('   First entry type:', firstEntry.type);
        } catch (e) {
          console.log('   Format: Invalid JSON ❌');
        }
      }
    } else {
      console.log('❌ Transcript file does NOT exist');
    }
  }

  console.log('\n=== Step 3: Coordinator Metrics (After Completion) ===');
  if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
    const coordMetrics = run.coordinatorMetrics as any;

    if (coordMetrics) {
      console.log('✅ coordinatorMetrics field exists');
      console.log('   Tokens Input:', coordMetrics.tokensInput);
      console.log('   Tokens Output:', coordMetrics.tokensOutput);
      console.log('   Total Tokens:', coordMetrics.totalTokens);
      console.log('   Cost USD:', coordMetrics.costUsd);
      console.log('   Tool Calls:', coordMetrics.toolCalls);
      console.log('   User Prompts:', coordMetrics.userPrompts);
      console.log('   Iterations:', coordMetrics.iterations);
      console.log('   Data Source:', coordMetrics.dataSource);
      console.log('   Transcript Path:', coordMetrics.transcriptPath || 'NULL');

      if (coordMetrics.tokensInput > 0 || coordMetrics.tokensOutput > 0) {
        console.log('\n🎉 SUCCESS! Coordinator metrics are NON-ZERO!');
      } else {
        console.log('\n⚠️  WARNING: Coordinator metrics are still ZERO');
      }
    } else {
      console.log('❌ coordinatorMetrics field is NULL');
    }

    console.log('\n=== Step 4: Aggregate Metrics ===');
    console.log('Total Tokens Input:', run.totalTokensInput);
    console.log('Total Tokens Output:', run.totalTokensOutput);
    console.log('Total Tokens:', run.totalTokens);
    console.log('Estimated Cost:', run.estimatedCost);

    if (run.totalTokensInput > 0 || run.totalTokensOutput > 0) {
      console.log('\n🎉 SUCCESS! Aggregate metrics are NON-ZERO!');
    } else {
      console.log('\n⚠️  WARNING: Aggregate metrics are still ZERO');
    }
  } else {
    console.log('⏳ Workflow still running - metrics calculated on completion');
  }

  console.log('\n=== Validation Summary ===');
  const checks = {
    'Transcript tracking initialized': !!transcriptTracking,
    'Orchestrator transcript recorded': !!transcriptTracking?.orchestratorTranscript,
    'Workflow completed': ['completed', 'failed', 'cancelled'].includes(run.status),
    'Coordinator metrics exist': !!(run.coordinatorMetrics),
    'Metrics are non-zero': !!(run as any).coordinatorMetrics?.tokensInput > 0 || !!(run as any).coordinatorMetrics?.tokensOutput > 0
  };

  Object.entries(checks).forEach(([check, passed]) => {
    console.log(passed ? '✅' : '❌', check);
  });

  const allPassed = Object.values(checks).every(v => v);
  if (allPassed) {
    console.log('\n🎉🎉🎉 ST-17 FIX VALIDATED SUCCESSFULLY! 🎉🎉🎉');
  } else {
    console.log('\n⚠️  Some checks failed - review details above');
  }
}

validateST28()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
