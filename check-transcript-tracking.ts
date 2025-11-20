import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTranscriptTracking() {
  const run = await prisma.workflowRun.findUnique({
    where: { id: '53270d37-dc95-49ee-9e49-53770448e5e2' },
    select: { metadata: true, startedAt: true, finishedAt: true }
  });

  if (run?.metadata) {
    const metadata = run.metadata as any;
    console.log('=== ST-27 Workflow Run Metadata ===');
    console.log('Started:', run.startedAt);
    console.log('Finished:', run.finishedAt);
    console.log('\nTranscript Tracking Info:');
    console.log(JSON.stringify(metadata._transcriptTracking, null, 2));

    // Check if transcripts exist
    const fs = require('fs');
    const path = require('path');

    if (metadata._transcriptTracking?.transcriptDirectory) {
      const dir = metadata._transcriptTracking.transcriptDirectory;
      console.log('\n=== Checking Transcript Directory ===');
      console.log('Directory:', dir);

      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir)
          .filter((f: string) => f.endsWith('.jsonl'))
          .map((f: string) => {
            const stats = fs.statSync(path.join(dir, f));
            return {
              name: f,
              size: stats.size,
              modified: stats.mtime
            };
          })
          .sort((a: any, b: any) => b.modified.getTime() - a.modified.getTime());

        console.log('\nTranscript files found:', files.length);
        console.log('\nTop 5 most recent:');
        files.slice(0, 5).forEach((f: any, i: number) => {
          console.log(`${i + 1}. ${f.name}`);
          console.log(`   Size: ${f.size} bytes`);
          console.log(`   Modified: ${f.modified.toISOString()}`);
        });

        if (metadata._transcriptTracking.orchestratorTranscript) {
          const orchestratorPath = path.join(dir, metadata._transcriptTracking.orchestratorTranscript);
          console.log('\n=== Orchestrator Transcript ===');
          console.log('Expected file:', metadata._transcriptTracking.orchestratorTranscript);
          console.log('File exists:', fs.existsSync(orchestratorPath));
          if (fs.existsSync(orchestratorPath)) {
            const stats = fs.statSync(orchestratorPath);
            console.log('Size:', stats.size, 'bytes');
            console.log('Modified:', stats.mtime.toISOString());
          }
        }
      } else {
        console.log('ERROR: Directory does not exist!');
      }
    }
  } else {
    console.log('No metadata found for workflow run');
  }
}

checkTranscriptTracking()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
