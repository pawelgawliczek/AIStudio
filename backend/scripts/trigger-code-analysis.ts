#!/usr/bin/env tsx
/**
 * Trigger code analysis for a project
 * Usage: tsx scripts/trigger-code-analysis.ts <projectId>
 */

import { PrismaClient } from '@prisma/client';
import Bull from 'bull';

const prisma = new PrismaClient();

async function main() {
  const projectId = process.argv[2] || '345a29ee-d6ab-477d-8079-c5dda0844d77';

  console.log(`Triggering code analysis for project: ${projectId}`);

  // Check if project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, localPath: true },
  });

  if (!project) {
    console.error(`Project ${projectId} not found`);
    process.exit(1);
  }

  if (!project.localPath) {
    console.error(`Project ${project.name} has no local path configured`);
    process.exit(1);
  }

  console.log(`Project: ${project.name}`);
  console.log(`Local Path: ${project.localPath}`);

  // Connect to Bull queue
  const codeAnalysisQueue = new Bull('code-analysis', {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6380'),
    },
  });

  // Add job to queue
  const job = await codeAnalysisQueue.add(
    'analyze-project',
    { projectId },
    {
      priority: 1, // High priority
      removeOnComplete: false, // Keep for debugging
      removeOnFail: false,
    },
  );

  console.log(`\nJob created: ${job.id}`);
  console.log(`Status: ${await job.getState()}`);
  console.log('\nWaiting for analysis to complete...');

  // Wait for job to complete
  const result = await job.finished();
  console.log('\nAnalysis completed!');
  console.log('Result:', result);

  // Clean up
  await codeAnalysisQueue.close();
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
