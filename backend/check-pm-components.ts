import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Check for PM/coordinator components
    const components = await prisma.component.findMany({
      where: {
        OR: [
          { name: { contains: 'PM', mode: 'insensitive' } },
          { name: { contains: 'coordinator', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        name: true,
        active: true,
        tags: true,
        createdAt: true
      }
    });

    console.log('=== Components with PM/coordinator in name ===');
    console.log(JSON.stringify(components, null, 2));

    // Check workflows using these components
    const workflows = await prisma.workflow.findMany({
      select: {
        id: true,
        name: true,
        coordinatorId: true,
        coordinator: {
          select: {
            id: true,
            name: true,
            tags: true
          }
        }
      }
    });

    console.log('\n=== Workflows and their coordinators ===');
    console.log(JSON.stringify(workflows, null, 2));

    // Check if PM component is used in any workflows or workflow runs
    if (components.length > 0) {
      for (const component of components) {
        console.log(`\n=== Checking component: ${component.name} (${component.id}) ===`);

        // Check if used as coordinator in workflows
        const workflowsUsingThis = await prisma.workflow.count({
          where: {
            coordinatorId: component.id
          }
        });
        console.log(`Used as coordinator in ${workflowsUsingThis} workflow(s)`);

        // Check if used in component runs
        const componentRuns = await prisma.componentRun.count({
          where: {
            componentId: component.id
          }
        });
        console.log(`Used in ${componentRuns} component run(s)`);

        // Get recent component runs
        if (componentRuns > 0) {
          const recentRuns = await prisma.componentRun.findMany({
            where: {
              componentId: component.id
            },
            select: {
              id: true,
              workflowRunId: true,
              status: true,
              startedAt: true
            },
            orderBy: {
              startedAt: 'desc'
            },
            take: 3
          });
          console.log('Recent runs:', JSON.stringify(recentRuns, null, 2));
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
