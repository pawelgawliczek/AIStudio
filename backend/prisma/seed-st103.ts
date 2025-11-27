import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding test data for ST-103 (Team Versioning)...');

  // Get the first project
  let project = await prisma.project.findFirst();

  if (!project) {
    project = await prisma.project.create({
      data: {
        name: 'AI Studio MCP Control Plane',
        description: 'Test project for ST-103',
        status: 'active',
      },
    });
    console.log('✓ Created project:', project.name);
  } else {
    console.log('✓ Using existing project:', project.name);
  }

  // Create test components (agents)
  const agents = [];
  const agentNames = [
    { name: 'Code Analyzer Agent', desc: 'Analyzes code quality and patterns' },
    { name: 'Test Generator Agent', desc: 'Generates unit and integration tests' },
    { name: 'Documentation Agent', desc: 'Creates and updates documentation' },
  ];

  for (const { name, desc } of agentNames) {
    const existing = await prisma.component.findFirst({
      where: { projectId: project.id, name },
    });

    if (!existing) {
      const agent = await prisma.component.create({
        data: {
          projectId: project.id,
          name,
          description: desc,
          inputInstructions: `Process input for ${name}`,
          operationInstructions: `Execute ${name.toLowerCase()} operations`,
          outputInstructions: `Format output for ${name.toLowerCase()}`,
          config: {
            modelId: 'claude-3-5-sonnet-20241022',
            temperature: 0.7,
          },
          tools: ['mcp__vibestudio__*'],
          tags: ['agent'],
          active: true,
          versionMajor: 1,
          versionMinor: 0,
        },
      });
      agents.push(agent);
      console.log(`✓ Created agent: ${name}`);
    } else {
      agents.push(existing);
      console.log(`✓ Using existing agent: ${name}`);
    }
  }

  // Create test project managers (coordinators)
  const projectManagers = [];
  const pmNames = [
    { name: 'Standard PM', desc: 'Standard project management coordinator' },
    { name: 'Agile PM', desc: 'Agile-focused project manager' },
  ];

  for (const { name, desc } of pmNames) {
    const existing = await prisma.component.findFirst({
      where: { projectId: project.id, name },
    });

    if (!existing) {
      const pm = await prisma.component.create({
        data: {
          projectId: project.id,
          name,
          description: desc,
          inputInstructions: 'Receive workflow context and story information',
          operationInstructions: `Coordinate team execution using ${name.toLowerCase()} methodology`,
          outputInstructions: 'Produce workflow execution results',
          config: {
            modelId: 'claude-3-5-sonnet-20241022',
            temperature: 0.5,
            decisionStrategy: 'sequential',
          },
          tools: ['mcp__vibestudio__*'],
          tags: ['coordinator', 'project-manager'],
          active: true,
          versionMajor: 1,
          versionMinor: 0,
        },
      });
      projectManagers.push(pm);
      console.log(`✓ Created PM: ${name}`);
    } else {
      projectManagers.push(existing);
      console.log(`✓ Using existing PM: ${name}`);
    }
  }

  // Create test workflows/teams
  const teams = [];
  const teamConfigs = [
    {
      name: 'Code Review Team',
      desc: 'Automated code review and analysis',
      pmId: projectManagers[0].id,
      agentIds: [agents[0].id, agents[2].id],
    },
    {
      name: 'Testing Team',
      desc: 'Comprehensive test generation and validation',
      pmId: projectManagers[1].id,
      agentIds: [agents[1].id, agents[2].id],
    },
    {
      name: 'Full Stack Team',
      desc: 'End-to-end development team',
      pmId: projectManagers[0].id,
      agentIds: agents.map(a => a.id),
    },
  ];

  for (const config of teamConfigs) {
    const existing = await prisma.workflow.findFirst({
      where: { projectId: project.id, name: config.name },
    });

    if (!existing) {
      const team = await prisma.workflow.create({
        data: {
          projectId: project.id,
          coordinatorId: config.pmId,
          name: config.name,
          description: config.desc,
          versionMajor: 1,
          versionMinor: 0,
          componentAssignments: config.agentIds.map((agentId, idx) => ({
            componentId: agentId,
            componentName: agents.find(a => a.id === agentId)?.name || 'Unknown',
            version: 'v1.0',
            role: `agent-${idx + 1}`,
          })),
          triggerConfig: {},
          active: true,
        },
      });
      teams.push(team);
      console.log(`✓ Created team: ${config.name}`);
    } else {
      teams.push(existing);
      console.log(`✓ Using existing team: ${config.name}`);
    }
  }

  // Create a second version of the first team for testing version filtering
  if (teams.length > 0) {
    const firstTeam = teams[0];
    const secondVersion = await prisma.workflow.findFirst({
      where: {
        projectId: project.id,
        name: firstTeam.name,
        versionMajor: 1,
        versionMinor: 1,
      },
    });

    if (!secondVersion) {
      const v2 = await prisma.workflow.create({
        data: {
          projectId: project.id,
          coordinatorId: firstTeam.coordinatorId,
          name: firstTeam.name,
          description: `${firstTeam.description} (v1.1 - Enhanced)`,
          versionMajor: 1,
          versionMinor: 1,
          parentId: firstTeam.id,
          createdFromVersion: 'v1.0',
          changeDescription: 'Added additional agent for better coverage',
          componentAssignments: [
            ...(firstTeam.componentAssignments as any[]),
            {
              componentId: agents[1].id,
              componentName: agents[1].name,
              version: 'v1.0',
              role: 'agent-3',
            },
          ],
          triggerConfig: {},
          active: true,
        },
      });
      console.log(`✓ Created team version v1.1: ${v2.name}`);
    } else {
      console.log(`✓ Using existing team version v1.1`);
    }
  }

  console.log('\n🎉 ST-103 test data seeded successfully!');
  console.log(`\n📊 Summary:`);
  console.log(`   Project: ${project.name}`);
  console.log(`   Agents: ${agents.length}`);
  console.log(`   Project Managers: ${projectManagers.length}`);
  console.log(`   Teams (Workflows): ${teams.length + 1} (includes v1.1)`);
  console.log(`\n🚀 Open http://localhost:5173/teams?projectId=${project.id}`);
}

main()
  .catch((e) => {
    console.error('Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
