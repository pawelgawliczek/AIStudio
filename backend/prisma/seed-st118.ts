import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({ where: { status: 'active' } });
  const user = await prisma.user.findFirst();
  const epic = await prisma.epic.findFirst({ where: { key: 'EP-2' } });

  if (!project || !user || !epic) {
    throw new Error('Missing project, user, or epic');
  }

  const story = await prisma.story.create({
    data: {
      project: { connect: { id: project.id } },
      epic: { connect: { id: epic.id } },
      createdBy: { connect: { id: user.id } },
      key: 'ST-118',
      title: 'Fix infinite localStorage.setItem loop causing 100% CPU usage',
      description: `## Problem
The VibeStudio frontend was causing 100% CPU usage in both Firefox and Chrome browsers.

## Root Cause
The \`cleanupExpandedRuns\` function in \`useWorkflowSettings.ts\` was always creating a new settings object (via spread operator) even when nothing changed. Combined with the \`useEffect\` in \`MultiRunStatusBar.tsx\` that ran on every \`runs\` change (which happens every 5 seconds from React Query polling), this caused an infinite loop:

1. React Query refetches → new \`runs\` array reference
2. \`useEffect\` triggers → calls \`cleanupExpandedRuns\`
3. \`cleanupExpandedRuns\` creates new settings object (even if unchanged)
4. New settings triggers \`useEffect\` that saves to localStorage
5. Repeat infinitely → ~180,000 localStorage.setItem calls

## Fix
1. Modified \`cleanupExpandedRuns\` to return the same reference if nothing actually changed
2. Added memoization and ref tracking in \`MultiRunStatusBar\` to only call cleanup when run IDs actually change

## Files Changed
- \`frontend/src/hooks/useWorkflowSettings.ts\`
- \`frontend/src/components/workflow/MultiRunStatusBar.tsx\``,
      status: 'done',
      type: 'bug',
      businessComplexity: 4,
      technicalComplexity: 3,
    },
  });

  console.log('✓ Created story:', story.key, '-', story.title);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
