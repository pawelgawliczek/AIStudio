import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateCoordinatorInstructions() {
  const coordinatorId = '0f37e71a-b69c-4ff8-a3c1-3ea83d098181';
  
  const currentCoordinator = await prisma.coordinatorAgent.findUnique({
    where: { id: coordinatorId },
    select: { coordinatorInstructions: true },
  });

  if (!currentCoordinator) {
    console.error('Coordinator not found');
    return;
  }

  // Add new section about metrics extraction before the existing "COORDINATOR RESPONSIBILITIES" section
  const metricsExtractionSection = `

STEP 3.5: EXTRACT METRICS FROM TASK TOOL OUTPUT

🎯 CRITICAL: When the Task tool completes, you will see a system report like:
"● Task(Component Name)
  ⎿  Done (X tool uses · Y tokens · Z time)"

You MUST parse this output to extract the actual metrics:
- Tokens: Parse "Y tokens" (e.g., "98.9k tokens" → 98900)
- Duration: Parse "Z time" (e.g., "3m 17s" → 197 seconds)
- Tool uses: Parse "X tool uses" (e.g., "33 tool uses" → 33)

**DO NOT fabricate or estimate these numbers.** Extract them from the Task tool output.

Example parsing:
- "98.9k tokens" → 98900
- "45.2k tokens" → 45200
- "1.2M tokens" → 1200000
- "3m 17s" → 197 seconds (3*60 + 17)
- "1h 5m 30s" → 3930 seconds (1*3600 + 5*60 + 30)
- "45s" → 45 seconds

When calling record_component_complete, use these EXACT extracted values:
- tokensUsed: Total tokens from output
- durationSeconds: Actual execution time in seconds
- systemIterations: Tool uses count (approximation for iterations)

`;

  const updatedInstructions = currentCoordinator.coordinatorInstructions.replace(
    'STEP 3: EXECUTE COMPONENTS - CRITICAL SPAWNING INSTRUCTIONS',
    'STEP 3: EXECUTE COMPONENTS - CRITICAL SPAWNING INSTRUCTIONS' + metricsExtractionSection
  );

  const result = await prisma.coordinatorAgent.update({
    where: { id: coordinatorId },
    data: {
      coordinatorInstructions: updatedInstructions,
    },
  });

  console.log('✅ Updated coordinator instructions with metrics extraction guidance');
  console.log(`Coordinator ID: ${result.id}`);
  console.log(`Updated at: ${result.updatedAt}`);
}

updateCoordinatorInstructions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
