import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Cleaning test data from database...');
  console.log('✅ Preserving: Code quality metrics, use cases, and test coverage data\n');

  try {
    // Delete in order respecting foreign key constraints

    // 1. Delete workflow-related data
    console.log('🗑️  Deleting workflow runs and component runs...');
    const deletedComponentRuns = await prisma.componentRun.deleteMany({});
    console.log(`   Deleted ${deletedComponentRuns.count} component runs`);

    const deletedWorkflowRuns = await prisma.workflowRun.deleteMany({});
    console.log(`   Deleted ${deletedWorkflowRuns.count} workflow runs`);

    const deletedActiveWorkflows = await prisma.activeWorkflow.deleteMany({});
    console.log(`   Deleted ${deletedActiveWorkflows.count} active workflows`);

    const deletedWorkflows = await prisma.workflow.deleteMany({});
    console.log(`   Deleted ${deletedWorkflows.count} workflows`);

    // 2. Delete coordinators
    console.log('\n🗑️  Deleting coordinator agents...');
    const deletedCoordinators = await prisma.coordinatorAgent.deleteMany({});
    console.log(`   Deleted ${deletedCoordinators.count} coordinators`);

    // 3. Delete components (workflow components, not feature components)
    console.log('\n🗑️  Deleting workflow components...');
    const deletedComponents = await prisma.component.deleteMany({});
    console.log(`   Deleted ${deletedComponents.count} components`);

    // 4. Delete test stories and related data
    console.log('\n🗑️  Deleting test stories...');

    // Delete subtasks first
    const deletedSubtasks = await prisma.subtask.deleteMany({});
    console.log(`   Deleted ${deletedSubtasks.count} subtasks`);

    // Delete story-use case links
    const deletedStoryUseCaseLinks = await prisma.storyUseCaseLink.deleteMany({});
    console.log(`   Deleted ${deletedStoryUseCaseLinks.count} story-use case links`);

    // Delete release items
    const deletedReleaseItems = await prisma.releaseItem.deleteMany({});
    console.log(`   Deleted ${deletedReleaseItems.count} release items`);

    // Delete defects (old schema)
    const deletedDefects = await prisma.defect.deleteMany({});
    console.log(`   Deleted ${deletedDefects.count} defects`);

    // Delete defects (new schema)
    const deletedDefectsNew = await prisma.defectNew.deleteMany({});
    console.log(`   Deleted ${deletedDefectsNew.count} new defects`);

    // Delete commit files
    const deletedCommitFiles = await prisma.commitFile.deleteMany({});
    console.log(`   Deleted ${deletedCommitFiles.count} commit files`);

    // Delete commits
    const deletedCommits = await prisma.commit.deleteMany({});
    console.log(`   Deleted ${deletedCommits.count} commits`);

    // Delete runs
    const deletedRuns = await prisma.run.deleteMany({});
    console.log(`   Deleted ${deletedRuns.count} runs`);

    // Delete stories
    const deletedStories = await prisma.story.deleteMany({});
    console.log(`   Deleted ${deletedStories.count} stories`);

    // 5. Delete test epics
    console.log('\n🗑️  Deleting test epics...');
    const deletedEpics = await prisma.epic.deleteMany({});
    console.log(`   Deleted ${deletedEpics.count} epics`);

    // 6. Delete agent frameworks
    console.log('\n🗑️  Deleting agent frameworks...');
    const deletedFrameworks = await prisma.agentFramework.deleteMany({});
    console.log(`   Deleted ${deletedFrameworks.count} frameworks`);

    // 7. Delete agents
    console.log('\n🗑️  Deleting agents...');
    const deletedAgents = await prisma.agent.deleteMany({});
    console.log(`   Deleted ${deletedAgents.count} agents`);

    // 8. Delete releases
    console.log('\n🗑️  Deleting releases...');
    const deletedReleases = await prisma.release.deleteMany({});
    console.log(`   Deleted ${deletedReleases.count} releases`);

    // Summary of what's preserved
    console.log('\n✅ Preserved data:');
    const codeMetricsCount = await prisma.codeMetrics.count();
    console.log(`   📊 Code metrics: ${codeMetricsCount} records`);

    const useCasesCount = await prisma.useCase.count();
    console.log(`   📝 Use cases: ${useCasesCount} records`);

    const testCasesCount = await prisma.testCase.count();
    console.log(`   🧪 Test cases: ${testCasesCount} records`);

    const fileUseCaseLinksCount = await prisma.fileUseCaseLink.count();
    console.log(`   🔗 File-use case mappings: ${fileUseCaseLinksCount} records`);

    const projectsCount = await prisma.project.count();
    console.log(`   📦 Projects: ${projectsCount} records`);

    console.log('\n🎉 Database cleanup completed successfully!');
    console.log('💡 Code quality data and use cases have been preserved.');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('Error cleaning data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
