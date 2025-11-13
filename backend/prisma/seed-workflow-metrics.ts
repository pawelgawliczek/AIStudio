import { PrismaClient, RunStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding workflow metrics data...');

  // Get the first project
  const project = await prisma.project.findFirst();
  if (!project) {
    throw new Error('No project found. Please create a project first.');
  }

  console.log(`📦 Using project: ${project.name} (${project.id})`);

  // Create or find a test coordinator
  let coordinator = await prisma.coordinatorAgent.findFirst({
    where: { projectId: project.id },
  });

  if (!coordinator) {
    coordinator = await prisma.coordinatorAgent.create({
      data: {
        project: { connect: { id: project.id } },
        name: 'Test Coordinator',
        description: 'Coordinator for test workflows',
        domain: 'software-development',
        coordinatorInstructions: 'Coordinate workflow execution for testing and metrics collection',
        config: {
          modelId: 'claude-3-5-sonnet-20241022',
          temperature: 0.7,
          maxInputTokens: 10000,
          maxOutputTokens: 4000,
        },
        tools: [],
        decisionStrategy: 'sequential',
        componentIds: [],
        active: true,
      },
    });
    console.log(`✅ Created coordinator: ${coordinator.name}`);
  }

  // Create test workflows if they don't exist
  const workflows = [];
  const workflowNames = [
    'Code Review Workflow',
    'Test Generation Workflow',
    'Documentation Workflow',
  ];

  for (const name of workflowNames) {
    let workflow = await prisma.workflow.findFirst({
      where: { projectId: project.id, name },
    });

    if (!workflow) {
      workflow = await prisma.workflow.create({
        data: {
          project: { connect: { id: project.id } },
          coordinator: { connect: { id: coordinator.id } },
          name,
          version: '1.0.0',
          description: `Automated ${name.toLowerCase()}`,
          triggerConfig: {},
          active: true,
        },
      });
      console.log(`✅ Created workflow: ${name}`);
    }

    workflows.push(workflow);
  }

  // Create test components if they don't exist
  const components = [];
  const componentNames = [
    'Code Analyzer',
    'Test Generator',
    'Documentation Writer',
    'Code Formatter',
  ];

  for (const name of componentNames) {
    let component = await prisma.component.findFirst({
      where: { projectId: project.id, name },
    });

    if (!component) {
      component = await prisma.component.create({
        data: {
          project: { connect: { id: project.id } },
          name,
          description: `${name} component for testing`,
          inputInstructions: `Process input for ${name}`,
          operationInstructions: `Execute ${name} operations`,
          outputInstructions: `Format output for ${name}`,
          config: {
            modelId: 'claude-3-5-sonnet-20241022',
            temperature: 0.7,
          },
          tools: [],
          tags: ['test'],
          active: true,
        },
      });
      console.log(`✅ Created component: ${name}`);
    }

    components.push(component);
  }

  // Generate workflow runs for the past 8 weeks
  const now = new Date();
  const weeksToGenerate = 8;
  const runsPerWeek = 5;

  let totalRuns = 0;

  for (let week = 0; week < weeksToGenerate; week++) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (week * 7));

    for (let run = 0; run < runsPerWeek; run++) {
      // Pick a random workflow
      const workflow = workflows[Math.floor(Math.random() * workflows.length)];

      // Random success rate (85% success)
      const isSuccess = Math.random() > 0.15;
      const status = isSuccess ? RunStatus.completed : RunStatus.failed;

      // Random but realistic metrics with some variance by week
      const weekMultiplier = 1 + (week * 0.05); // Slight improvement over time
      const durationSeconds = Math.floor((300 + Math.random() * 600) / weekMultiplier);
      const tokensInput = Math.floor((5000 + Math.random() * 3000) * weekMultiplier);
      const tokensOutput = Math.floor((2000 + Math.random() * 1500) * weekMultiplier);
      const totalTokens = tokensInput + tokensOutput;
      const locGenerated = Math.floor(50 + Math.random() * 200);
      const estimatedCost = (totalTokens / 1000) * 0.002; // $0.002 per 1k tokens

      // Random start time within the week
      const startedAt = new Date(weekStart);
      startedAt.setHours(Math.floor(Math.random() * 24));
      startedAt.setMinutes(Math.floor(Math.random() * 60));

      const finishedAt = new Date(startedAt);
      finishedAt.setSeconds(finishedAt.getSeconds() + durationSeconds);

      // Create workflow run
      const workflowRun = await prisma.workflowRun.create({
        data: {
          projectId: project.id,
          workflowId: workflow.id,
          status,
          startedAt,
          finishedAt,
          durationSeconds,
          totalTokensInput: tokensInput,
          totalTokensOutput: tokensOutput,
          totalTokens,
          totalLocGenerated: locGenerated,
          estimatedCost,
          errorMessage: isSuccess ? null : 'Simulated test failure',
        },
      });

      // Create component runs for this workflow run
      const numComponents = 2 + Math.floor(Math.random() * 2); // 2-3 components per workflow
      const selectedComponents = components
        .sort(() => 0.5 - Math.random())
        .slice(0, numComponents);

      for (const component of selectedComponents) {
        const componentSuccess = isSuccess && Math.random() > 0.1; // 90% component success if workflow succeeded
        const componentStatus = componentSuccess ? RunStatus.completed : RunStatus.failed;

        const componentDuration = Math.floor(durationSeconds / numComponents);
        const componentTokensInput = Math.floor(tokensInput / numComponents);
        const componentTokensOutput = Math.floor(tokensOutput / numComponents);
        const componentTokens = componentTokensInput + componentTokensOutput;
        const componentLoc = Math.floor(locGenerated / numComponents);

        const componentStartedAt = new Date(startedAt);
        const componentFinishedAt = new Date(componentStartedAt);
        componentFinishedAt.setSeconds(componentFinishedAt.getSeconds() + componentDuration);

        await prisma.componentRun.create({
          data: {
            workflowRunId: workflowRun.id,
            componentId: component.id,
            status: componentStatus,
            success: componentSuccess,
            startedAt: componentStartedAt,
            finishedAt: componentFinishedAt,
            tokensInput: componentTokensInput,
            tokensOutput: componentTokensOutput,
            totalTokens: componentTokens,
            durationSeconds: componentDuration,
            locGenerated: componentLoc,
            filesModified: [`src/file${Math.floor(Math.random() * 100)}.ts`],
            commits: [],
            tokensPerLoc: componentLoc > 0 ? componentTokens / componentLoc : 0,
            locPerPrompt: componentLoc > 0 ? componentLoc / 10 : 0,
            runtimePerLoc: componentLoc > 0 ? componentDuration / componentLoc : 0,
            runtimePerToken: componentTokens > 0 ? componentDuration / componentTokens : 0,
          },
        });
      }

      totalRuns++;
    }

    console.log(`📊 Generated ${runsPerWeek} workflow runs for week -${week}`);
  }

  console.log(`\n✅ Successfully seeded ${totalRuns} workflow runs with component data!`);
  console.log(`📈 Data spans ${weeksToGenerate} weeks for trending analysis`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
