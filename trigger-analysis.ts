import { PrismaClient } from './backend/prisma/generated/client';
import { Queue } from 'bull';

async function triggerAnalysis() {
  const prisma = new PrismaClient();

  try {
    const projectId = '345a29ee-d6ab-477d-8079-c5dda0844d77';

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      console.error('Project not found');
      process.exit(1);
    }

    console.log(`Project found: ${project.name}`);
    console.log(`Local path: ${project.localPath}`);

    // Create Redis connection for Bull queue
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    console.log(`Connecting to Redis: ${redisUrl}`);

    // Create queue instance
    const codeAnalysisQueue = new Queue('code-analysis', redisUrl);

    // Add job to queue
    const job = await codeAnalysisQueue.add('analyze-project', {
      projectId,
    });

    console.log(`✅ Analysis job queued successfully! Job ID: ${job.id}`);

    // Wait a moment for the job to be picked up
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check job status
    const jobStatus = await job.getState();
    console.log(`Job status: ${jobStatus}`);

    await codeAnalysisQueue.close();
    await prisma.$disconnect();

  } catch (error) {
    console.error('Error triggering analysis:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

triggerAnalysis();
