#!/usr/bin/env tsx
/**
 * Sync GitHub PR data to database
 * Extracts acceptance criteria, reviewers, and other metadata from PRs
 */

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PRData {
  number: number;
  title: string;
  body: string;
  mergedAt: string;
  author: {
    login: string;
  };
  reviewDecision: string;
  reviews: any[];
}

function extractStoryKeys(text: string): string[] {
  const storyKeyPattern = /\b(ST|EP)-\d+\b/gi;
  const matches = text.match(storyKeyPattern);
  return matches ? [...new Set(matches.map(k => k.toUpperCase()))] : [];
}

function extractAcceptanceCriteria(body: string): string[] {
  const criteria: string[] = [];

  // Pattern 1: Checkboxes (- [ ] or - [x])
  const checkboxPattern = /^[-*]\s*\[[ xX]\]\s*(.+)$/gm;
  let match;
  while ((match = checkboxPattern.exec(body)) !== null) {
    criteria.push(match[1].trim());
  }

  // Pattern 2: "Acceptance Criteria" section
  const acSection = body.match(/## Acceptance Criteria[\s\S]*?(?=##|$)/i);
  if (acSection) {
    const lines = acSection[0].split('\n').slice(1); // Skip header
    for (const line of lines) {
      const cleaned = line.replace(/^[-*✅]\s*/, '').trim();
      if (cleaned && !cleaned.startsWith('#')) {
        criteria.push(cleaned);
      }
    }
  }

  return [...new Set(criteria)];
}

function extractSummary(body: string): string | null {
  // Try to extract Summary section
  const summaryMatch = body.match(/##\s*Summary\s*\n([\s\S]*?)(?=\n##|\n---|$)/i);
  if (summaryMatch) {
    return summaryMatch[1].trim().substring(0, 500);
  }

  // Fallback: first paragraph
  const firstPara = body.split('\n\n')[0];
  return firstPara.substring(0, 500);
}

async function getPRData(): Promise<PRData[]> {
  console.log('Fetching PR data from GitHub...');

  const output = execSync(
    'gh pr list --state merged --limit 50 --json number,title,body,mergedAt,author,reviewDecision,reviews',
    { encoding: 'utf-8' }
  );

  return JSON.parse(output);
}

async function getStoryIdByKey(key: string): Promise<string | null> {
  const story = await prisma.story.findFirst({
    where: { key }
  });

  return story?.id || null;
}

async function updateStoryWithPRData(storyId: string, pr: PRData, storyKey: string) {
  const acceptanceCriteria = extractAcceptanceCriteria(pr.body);
  const summary = extractSummary(pr.body);

  // Update story description with AC if not already present
  const story = await prisma.story.findUnique({
    where: { id: storyId }
  });

  if (!story) return;

  let updatedDescription = story.description || '';

  // Add AC section if not present and we have ACs
  if (acceptanceCriteria.length > 0 && !updatedDescription.includes('## Acceptance Criteria')) {
    const acSection = '\n\n## Acceptance Criteria\n' +
      acceptanceCriteria.map(ac => `- ${ac}`).join('\n');
    updatedDescription += acSection;
  }

  // Add PR summary if description is empty
  if (!updatedDescription.trim() && summary) {
    updatedDescription = `## Summary (from PR #${pr.number})\n\n${summary}`;
  }

  // Update story
  await prisma.story.update({
    where: { id: storyId },
    data: {
      description: updatedDescription
    }
  });

  console.log(`  ✓ Updated story ${storyKey} with PR data`);
  console.log(`    - Added ${acceptanceCriteria.length} acceptance criteria`);
  console.log(`    - PR #${pr.number} merged ${new Date(pr.mergedAt).toLocaleDateString()}`);
}

async function main() {
  console.log('🔄 Syncing GitHub PR data to database...\n');

  const prs = await getPRData();
  console.log(`📊 Found ${prs.length} merged PRs\n`);

  let updated = 0;
  let skipped = 0;

  for (const pr of prs) {
    const storyKeys = extractStoryKeys(pr.title + ' ' + pr.body);

    if (storyKeys.length === 0) {
      skipped++;
      continue;
    }

    console.log(`\n📝 Processing PR #${pr.number}: ${pr.title.substring(0, 60)}...`);
    console.log(`   Story keys: ${storyKeys.join(', ')}`);

    for (const key of storyKeys) {
      const storyId = await getStoryIdByKey(key);

      if (!storyId) {
        console.log(`  ⚠️  Story ${key} not found in database`);
        continue;
      }

      try {
        await updateStoryWithPRData(storyId, pr, key);
        updated++;
      } catch (error) {
        console.error(`  ❌ Error updating story: ${error}`);
      }
    }
  }

  console.log(`\n✅ PR sync complete!`);
  console.log(`   Updated: ${updated} stories`);
  console.log(`   Skipped: ${skipped} PRs (no story key)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
