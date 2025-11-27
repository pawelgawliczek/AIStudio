#!/usr/bin/env tsx
/**
 * Sync git history to database
 * This script parses git log and uses MCP tools to:
 * 1. Link commits to stories
 * 2. Update file-to-usecase mappings
 * 3. Extract metrics from commits
 */

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CommitData {
  hash: string;
  author: string;
  email: string;
  timestamp: string;
  message: string;
  files: Array<{
    path: string;
    linesAdded: number;
    linesDeleted: number;
  }>;
  storyKeys: string[];
}

function extractStoryKeys(message: string): string[] {
  const storyKeyPattern = /\b(ST|EP)-\d+\b/gi;
  const matches = message.match(storyKeyPattern);
  return matches ? [...new Set(matches.map(k => k.toUpperCase()))] : [];
}

function parseGitLog(): CommitData[] {
  console.log('Fetching git log...');

  // Get commit data with file stats
  const gitLog = execSync(
    'git log --all --pretty=format:"%H|%an|%ae|%ai|%s" --numstat --no-merges -200',
    { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }
  );

  const commits: CommitData[] = [];
  const lines = gitLog.split('\n');

  let currentCommit: Partial<CommitData> | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    // Commit header line
    if (line.includes('|')) {
      if (currentCommit && currentCommit.hash) {
        commits.push(currentCommit as CommitData);
      }

      const [hash, author, email, timestamp, message] = line.split('|');
      const storyKeys = extractStoryKeys(message);

      currentCommit = {
        hash,
        author,
        email,
        timestamp,
        message,
        files: [],
        storyKeys
      };
    }
    // File stats line
    else if (currentCommit) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) {
        const [added, deleted, path] = parts;
        const linesAdded = added === '-' ? 0 : parseInt(added, 10);
        const linesDeleted = deleted === '-' ? 0 : parseInt(deleted, 10);

        if (!isNaN(linesAdded) && !isNaN(linesDeleted)) {
          currentCommit.files!.push({
            path,
            linesAdded,
            linesDeleted
          });
        }
      }
    }
  }

  // Add last commit
  if (currentCommit && currentCommit.hash) {
    commits.push(currentCommit as CommitData);
  }

  return commits;
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

async function getStoryIdByKey(key: string): Promise<string | null> {
  const story = await prisma.story.findFirst({
    where: { key }
  });

  return story?.id || null;
}

async function linkCommitToStory(
  commit: CommitData,
  storyId: string,
  projectId: string
) {
  // Check if commit already linked
  const existing = await prisma.commit.findUnique({
    where: { hash: commit.hash }
  });

  if (existing) {
    console.log(`  ✓ Commit ${commit.hash.substring(0, 8)} already linked`);
    return;
  }

  // Create commit record
  await prisma.commit.create({
    data: {
      hash: commit.hash,
      projectId,
      storyId,
      author: commit.author,
      timestamp: new Date(commit.timestamp),
      message: commit.message,
      files: {
        create: commit.files.map(f => ({
          filePath: f.path,
          locAdded: f.linesAdded,
          locDeleted: f.linesDeleted
        }))
      }
    }
  });

  console.log(`  ✓ Linked commit ${commit.hash.substring(0, 8)} to story ${storyId}`);
}

async function updateFileMappings(commit: CommitData, storyId: string) {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    include: {
      useCaseLinks: {
        include: {
          useCase: true
        }
      }
    }
  });

  if (!story || story.useCaseLinks.length === 0) {
    return;
  }

  // Update file-to-usecase mappings for each modified file
  for (const file of commit.files) {
    // Skip non-source files
    if (
      file.path.includes('node_modules') ||
      file.path.includes('__tests__') ||
      file.path.includes('.md') ||
      file.path.includes('.json') ||
      file.path.includes('.yml')
    ) {
      continue;
    }

    for (const storyUseCase of story.useCaseLinks) {
      const useCase = storyUseCase.useCase;

      // Check if mapping already exists
      const existing = await prisma.fileToCaseMapping.findFirst({
        where: {
          filePath: file.path,
          useCaseId: useCase.id
        }
      });

      if (existing) {
        // Update confidence and occurrences
        await prisma.fileToCaseMapping.update({
          where: { id: existing.id },
          data: {
            occurrences: existing.occurrences + 1,
            confidence: Math.min(1.0, existing.confidence + 0.1)
          }
        });
      } else {
        // Create new mapping
        await prisma.fileToCaseMapping.create({
          data: {
            projectId: story.projectId,
            useCaseId: useCase.id,
            filePath: file.path,
            source: 'COMMIT_DERIVED',
            confidence: 0.7,
            occurrences: 1
          }
        });
      }
    }
  }

  console.log(`  ✓ Updated file mappings for ${commit.files.length} files`);
}

async function main() {
  console.log('🔄 Syncing git history to database...\n');

  const projectId = await getProjectId();
  console.log(`📦 Project ID: ${projectId}\n`);

  const commits = parseGitLog();
  console.log(`📊 Found ${commits.length} commits\n`);

  let linked = 0;
  let skipped = 0;

  for (const commit of commits) {
    if (commit.storyKeys.length === 0) {
      skipped++;
      continue;
    }

    console.log(`\n📝 Processing commit ${commit.hash.substring(0, 8)}: ${commit.message.substring(0, 60)}...`);
    console.log(`   Story keys: ${commit.storyKeys.join(', ')}`);

    for (const key of commit.storyKeys) {
      const storyId = await getStoryIdByKey(key);

      if (!storyId) {
        console.log(`  ⚠️  Story ${key} not found in database`);
        continue;
      }

      try {
        await linkCommitToStory(commit, storyId, projectId);
        await updateFileMappings(commit, storyId);
        linked++;
      } catch (error) {
        console.error(`  ❌ Error linking commit: ${error}`);
      }
    }
  }

  console.log(`\n✅ Sync complete!`);
  console.log(`   Linked: ${linked} commits`);
  console.log(`   Skipped: ${skipped} commits (no story key)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
