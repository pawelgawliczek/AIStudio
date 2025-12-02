/**
 * Backfill Story Summaries Script
 *
 * This script generates auto-truncated summaries for existing stories
 * that don't have a summary field populated.
 *
 * Usage:
 *   DATABASE_URL="..." npx tsx src/scripts/backfill-story-summaries.ts
 *
 * Options:
 *   --dry-run    Preview changes without making updates
 *   --limit N    Process only N stories
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Auto-generate summary by truncating description to first 2 sentences
 */
function autoTruncateSummary(description: string | null | undefined): string | null {
  if (!description) return null;

  // Extract sentences (ending with . ! or ?)
  const sentences = description.match(/[^.!?]+[.!?]+/g) || [];

  if (sentences.length === 0) {
    // No proper sentences found, just truncate
    return description.slice(0, 300);
  }

  // Take first 2 sentences and join them
  const twoSentences = sentences.slice(0, 2).join(' ').trim();

  // Ensure we don't exceed 300 chars
  return twoSentences.slice(0, 300);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1], 10) : undefined;

  console.log('='.repeat(60));
  console.log('Story Summary Backfill Script');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will update database)'}`);
  if (limit) console.log(`Limit: ${limit} stories`);
  console.log('');

  // Find stories without summaries
  const storiesWithoutSummary = await prisma.story.findMany({
    where: {
      summary: null,
      description: { not: null },
    },
    select: {
      id: true,
      key: true,
      title: true,
      description: true,
    },
    take: limit,
  });

  console.log(`Found ${storiesWithoutSummary.length} stories without summaries\n`);

  if (storiesWithoutSummary.length === 0) {
    console.log('Nothing to do!');
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const story of storiesWithoutSummary) {
    const summary = autoTruncateSummary(story.description);

    if (!summary) {
      console.log(`[SKIP] ${story.key} - No description to generate summary from`);
      skipped++;
      continue;
    }

    console.log(`[${dryRun ? 'PREVIEW' : 'UPDATE'}] ${story.key}: ${story.title}`);
    console.log(`  Summary: ${summary.slice(0, 80)}${summary.length > 80 ? '...' : ''}`);
    console.log('');

    if (!dryRun) {
      await prisma.story.update({
        where: { id: story.id },
        data: { summary },
      });
    }

    updated++;
  }

  console.log('='.repeat(60));
  console.log(`Summary:`);
  console.log(`  ${dryRun ? 'Would update' : 'Updated'}: ${updated} stories`);
  console.log(`  Skipped: ${skipped} stories`);
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('\nRun without --dry-run to apply changes.');
  }
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
