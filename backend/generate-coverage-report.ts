#!/usr/bin/env tsx
/**
 * Generate code coverage report by story/epic
 * Shows which files are linked to which stories and epics
 */

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();

interface StoryCoverage {
  storyKey: string;
  storyTitle: string;
  epicKey?: string;
  epicTitle?: string;
  commitCount: number;
  fileCount: number;
  linesAdded: number;
  linesDeleted: number;
  filesModified: string[];
  useCaseCount: number;
  testCaseCount: number;
}

async function getProjectId(): Promise<string> {
  const project = await prisma.project.findFirst({
    where: { name: 'AI Studio' }
  });

  if (!project) {
    throw new Error('AI Studio project not found');
  }

  return project.id;
}

async function generateCoverageReport(): Promise<StoryCoverage[]> {
  const projectId = await getProjectId();

  // Get all stories with commits
  const stories = await prisma.story.findMany({
    where: {
      projectId,
      commits: {
        some: {}
      }
    },
    include: {
      epic: true,
      commits: {
        include: {
          files: true
        }
      },
      useCaseLinks: true,
      testExecutions: true
    },
    orderBy: {
      key: 'asc'
    }
  });

  const coverage: StoryCoverage[] = [];

  for (const story of stories) {
    const files = story.commits.flatMap(c => c.files);
    const uniqueFiles = [...new Set(files.map(f => f.filePath))];

    const linesAdded = files.reduce((sum, f) => sum + f.locAdded, 0);
    const linesDeleted = files.reduce((sum, f) => sum + f.locDeleted, 0);

    coverage.push({
      storyKey: story.key,
      storyTitle: story.title,
      epicKey: story.epic?.key,
      epicTitle: story.epic?.title,
      commitCount: story.commits.length,
      fileCount: uniqueFiles.length,
      linesAdded,
      linesDeleted,
      filesModified: uniqueFiles,
      useCaseCount: story.useCaseLinks.length,
      testCaseCount: story.testExecutions.length
    });
  }

  return coverage;
}

async function generateEpicSummary(): Promise<any[]> {
  const projectId = await getProjectId();

  const epics = await prisma.epic.findMany({
    where: { projectId },
    include: {
      stories: {
        include: {
          commits: {
            include: {
              files: true
            }
          }
        }
      }
    },
    orderBy: {
      key: 'asc'
    }
  });

  return epics.map(epic => {
    const allCommits = epic.stories.flatMap(s => s.commits);
    const allFiles = allCommits.flatMap(c => c.files);
    const uniqueFiles = [...new Set(allFiles.map(f => f.filePath))];

    return {
      epicKey: epic.key,
      epicTitle: epic.title,
      storyCount: epic.stories.length,
      storiesWithCommits: epic.stories.filter(s => s.commits.length > 0).length,
      totalCommits: allCommits.length,
      totalFiles: uniqueFiles.length,
      linesAdded: allFiles.reduce((sum, f) => sum + f.locAdded, 0),
      linesDeleted: allFiles.reduce((sum, f) => sum + f.locDeleted, 0)
    };
  });
}

async function main() {
  console.log('📊 Generating code coverage report...\n');

  const coverage = await generateCoverageReport();
  const epicSummary = await generateEpicSummary();

  // Generate markdown report
  let report = '# Code Coverage Report - AI Studio Project\n\n';
  report += `**Generated:** ${new Date().toLocaleString()}\n\n`;
  report += `**Total Stories with Code:** ${coverage.length}\n\n`;

  // Epic Summary
  report += '## Epic Summary\n\n';
  report += '| Epic | Title | Stories | Stories w/ Code | Commits | Files | LOC Added | LOC Deleted |\n';
  report += '|------|-------|---------|-----------------|---------|-------|-----------|-------------|\n';

  for (const epic of epicSummary) {
    report += `| ${epic.epicKey} | ${epic.epicTitle.substring(0, 40)} | ${epic.storyCount} | ${epic.storiesWithCommits} | ${epic.totalCommits} | ${epic.totalFiles} | +${epic.linesAdded} | -${epic.linesDeleted} |\n`;
  }

  report += '\n## Story-Level Coverage\n\n';
  report += '| Story | Title | Epic | Commits | Files | LOC Added | LOC Deleted | Use Cases | Tests |\n';
  report += '|-------|-------|------|---------|-------|-----------|-------------|-----------|-------|\n';

  for (const item of coverage) {
    const epicKey = item.epicKey || 'N/A';
    report += `| ${item.storyKey} | ${item.storyTitle.substring(0, 40)} | ${epicKey} | ${item.commitCount} | ${item.fileCount} | +${item.linesAdded} | -${item.linesDeleted} | ${item.useCaseCount} | ${item.testCaseCount} |\n`;
  }

  // Detailed file mappings
  report += '\n## Detailed File Mappings\n\n';

  for (const item of coverage.slice(0, 20)) { // Top 20 stories
    report += `### ${item.storyKey}: ${item.storyTitle}\n\n`;
    report += `**Epic:** ${item.epicTitle || 'None'}\n`;
    report += `**Commits:** ${item.commitCount} | **Files:** ${item.fileCount} | **LOC:** +${item.linesAdded}/-${item.linesDeleted}\n\n`;

    if (item.filesModified.length > 0) {
      report += '**Modified Files:**\n';
      for (const file of item.filesModified.slice(0, 10)) {
        report += `- ${file}\n`;
      }
      if (item.filesModified.length > 10) {
        report += `- ... and ${item.filesModified.length - 10} more\n`;
      }
    }
    report += '\n';
  }

  // Top Contributors
  report += '\n## Top File Changes by Story\n\n';
  const topByLOC = [...coverage].sort((a, b) =>
    (b.linesAdded + b.linesDeleted) - (a.linesAdded + a.linesDeleted)
  ).slice(0, 10);

  report += '| Rank | Story | Title | Total LOC Changed |\n';
  report += '|------|-------|-------|-------------------|\n';

  topByLOC.forEach((item, index) => {
    const totalLOC = item.linesAdded + item.linesDeleted;
    report += `| ${index + 1} | ${item.storyKey} | ${item.storyTitle.substring(0, 40)} | ${totalLOC.toLocaleString()} |\n`;
  });

  // Statistics
  report += '\n## Statistics\n\n';
  const totalCommits = coverage.reduce((sum, c) => sum + c.commitCount, 0);
  const totalFiles = [...new Set(coverage.flatMap(c => c.filesModified))].length;
  const totalLOCAdded = coverage.reduce((sum, c) => sum + c.linesAdded, 0);
  const totalLOCDeleted = coverage.reduce((sum, c) => sum + c.linesDeleted, 0);
  const totalUseCases = coverage.reduce((sum, c) => sum + c.useCaseCount, 0);
  const totalTests = coverage.reduce((sum, c) => sum + c.testCaseCount, 0);

  report += `- **Total Commits:** ${totalCommits}\n`;
  report += `- **Total Files Modified:** ${totalFiles}\n`;
  report += `- **Total Lines Added:** ${totalLOCAdded.toLocaleString()}\n`;
  report += `- **Total Lines Deleted:** ${totalLOCDeleted.toLocaleString()}\n`;
  report += `- **Total Lines Changed:** ${(totalLOCAdded + totalLOCDeleted).toLocaleString()}\n`;
  report += `- **Use Cases Linked:** ${totalUseCases}\n`;
  report += `- **Test Cases:** ${totalTests}\n`;
  report += `- **Average Commits per Story:** ${(totalCommits / coverage.length).toFixed(1)}\n`;
  report += `- **Average Files per Story:** ${(totalFiles / coverage.length).toFixed(1)}\n`;

  // Write report
  const reportPath = '/opt/stack/AIStudio/COVERAGE_REPORT.md';
  writeFileSync(reportPath, report);

  console.log('✅ Coverage report generated!\n');
  console.log(`📄 Report saved to: ${reportPath}\n`);
  console.log('📈 Summary:');
  console.log(`   - Stories with code: ${coverage.length}`);
  console.log(`   - Total commits: ${totalCommits}`);
  console.log(`   - Total files: ${totalFiles}`);
  console.log(`   - Total LOC changed: ${(totalLOCAdded + totalLOCDeleted).toLocaleString()}`);
  console.log(`   - Epics covered: ${epicSummary.filter(e => e.storiesWithCommits > 0).length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
