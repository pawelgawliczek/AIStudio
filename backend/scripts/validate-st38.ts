/**
 * ST-38: Schema Validation Script
 * Epic: EP-7 - Git Workflow Agent
 * QA Automation Component: Database Schema Validation
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ValidationResult {
  test: string;
  status: 'PASS' | 'FAIL';
  expected: string | number;
  actual: string | number;
  message?: string;
}

const results: ValidationResult[] = [];

function addResult(test: string, status: 'PASS' | 'FAIL', expected: string | number, actual: string | number, message?: string) {
  results.push({ test, status, expected, actual, message });
}

async function validateEnums() {
  console.log('\n========================================');
  console.log('1. ENUM VALIDATION');
  console.log('========================================\n');

  // Check WorktreeStatus enum
  const worktreeEnums = await prisma.$queryRaw<any[]>`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = 'WorktreeStatus'::regtype
    ORDER BY enumsortorder;
  `;
  const worktreeValues = worktreeEnums.map(e => e.enumlabel);
  const expectedWorktreeValues = ['active', 'idle', 'cleaning', 'removed'];
  const worktreeMatch = JSON.stringify(worktreeValues) === JSON.stringify(expectedWorktreeValues);

  addResult(
    'WorktreeStatus enum values',
    worktreeMatch ? 'PASS' : 'FAIL',
    expectedWorktreeValues.join(', '),
    worktreeValues.join(', ')
  );
  console.log(`✓ WorktreeStatus: ${worktreeValues.join(', ')}`);

  // Check QueueStatus enum
  const queueEnums = await prisma.$queryRaw<any[]>`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = 'QueueStatus'::regtype
    ORDER BY enumsortorder;
  `;
  const queueValues = queueEnums.map(e => e.enumlabel);
  const expectedQueueValues = ['pending', 'running', 'passed', 'failed', 'cancelled', 'skipped'];
  const queueMatch = JSON.stringify(queueValues) === JSON.stringify(expectedQueueValues);

  addResult(
    'QueueStatus enum values',
    queueMatch ? 'PASS' : 'FAIL',
    expectedQueueValues.join(', '),
    queueValues.join(', ')
  );
  console.log(`✓ QueueStatus: ${queueValues.join(', ')}`);

  // Check PRStatus enum
  const prEnums = await prisma.$queryRaw<any[]>`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = 'PRStatus'::regtype
    ORDER BY enumsortorder;
  `;
  const prValues = prEnums.map(e => e.enumlabel);
  const expectedPRValues = ['draft', 'open', 'approved', 'changes_requested', 'merged', 'closed', 'conflict'];
  const prMatch = JSON.stringify(prValues) === JSON.stringify(expectedPRValues);

  addResult(
    'PRStatus enum values',
    prMatch ? 'PASS' : 'FAIL',
    expectedPRValues.join(', '),
    prValues.join(', ')
  );
  console.log(`✓ PRStatus: ${prValues.join(', ')}`);

  // Check StoryPhase enum
  const phaseEnums = await prisma.$queryRaw<any[]>`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = 'StoryPhase'::regtype
    ORDER BY enumsortorder;
  `;
  const phaseValues = phaseEnums.map(e => e.enumlabel);
  const expectedPhaseValues = ['context', 'ba', 'design', 'architecture', 'implementation', 'testing', 'review', 'done'];
  const phaseMatch = JSON.stringify(phaseValues) === JSON.stringify(expectedPhaseValues);

  addResult(
    'StoryPhase enum values',
    phaseMatch ? 'PASS' : 'FAIL',
    expectedPhaseValues.join(', '),
    phaseValues.join(', ')
  );
  console.log(`✓ StoryPhase: ${phaseValues.join(', ')}`);
}

async function validateTables() {
  console.log('\n========================================');
  console.log('2. TABLE STRUCTURE VALIDATION');
  console.log('========================================\n');

  // Check Worktree table
  const worktreeColumns = await prisma.$queryRaw<any[]>`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'worktrees'
    ORDER BY ordinal_position;
  `;

  const worktreeExpectedColumns = ['id', 'story_id', 'branch_name', 'worktree_path', 'base_branch', 'status', 'created_at', 'updated_at'];
  const worktreeActualColumns = worktreeColumns.map(c => c.column_name);
  const worktreeMatch = worktreeExpectedColumns.every(col => worktreeActualColumns.includes(col));

  addResult(
    'Worktree table columns',
    worktreeMatch ? 'PASS' : 'FAIL',
    worktreeExpectedColumns.length,
    worktreeActualColumns.length
  );
  console.log(`✓ Worktree table: ${worktreeActualColumns.length} columns`);

  // Check TestQueue table
  const queueColumns = await prisma.$queryRaw<any[]>`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'test_queue'
    ORDER BY ordinal_position;
  `;

  const queueExpectedColumns = ['id', 'story_id', 'position', 'priority', 'status', 'submitted_by', 'test_results', 'error_message', 'created_at', 'updated_at'];
  const queueActualColumns = queueColumns.map(c => c.column_name);
  const queueMatch = queueExpectedColumns.every(col => queueActualColumns.includes(col));

  addResult(
    'TestQueue table columns',
    queueMatch ? 'PASS' : 'FAIL',
    queueExpectedColumns.length,
    queueActualColumns.length
  );
  console.log(`✓ TestQueue table: ${queueActualColumns.length} columns`);

  // Verify test_results is JSONB
  const testResultsType = queueColumns.find(c => c.column_name === 'test_results');
  const isJsonb = testResultsType?.data_type === 'jsonb';

  addResult(
    'TestQueue.test_results type',
    isJsonb ? 'PASS' : 'FAIL',
    'jsonb',
    testResultsType?.data_type || 'not found'
  );
  console.log(`✓ test_results type: ${testResultsType?.data_type}`);

  // Check PullRequest table
  const prColumns = await prisma.$queryRaw<any[]>`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'pull_requests'
    ORDER BY ordinal_position;
  `;

  const prExpectedColumns = ['id', 'story_id', 'pr_number', 'pr_url', 'title', 'description', 'status', 'created_at', 'updated_at'];
  const prActualColumns = prColumns.map(c => c.column_name);
  const prMatch = prExpectedColumns.every(col => prActualColumns.includes(col));

  addResult(
    'PullRequest table columns',
    prMatch ? 'PASS' : 'FAIL',
    prExpectedColumns.length,
    prActualColumns.length
  );
  console.log(`✓ PullRequest table: ${prActualColumns.length} columns`);
}

async function validateStoryExtension() {
  console.log('\n========================================');
  console.log('3. STORY MODEL EXTENSION VALIDATION');
  console.log('========================================\n');

  // Check currentPhase field
  const currentPhaseField = await prisma.$queryRaw<any[]>`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'stories' AND column_name = 'current_phase';
  `;

  const fieldExists = currentPhaseField.length === 1;
  const isNullable = currentPhaseField[0]?.is_nullable === 'YES';

  addResult(
    'Story.currentPhase field exists',
    fieldExists ? 'PASS' : 'FAIL',
    1,
    currentPhaseField.length
  );

  addResult(
    'Story.currentPhase is nullable',
    isNullable ? 'PASS' : 'FAIL',
    'YES',
    currentPhaseField[0]?.is_nullable || 'N/A'
  );

  console.log(`✓ currentPhase field: exists=${fieldExists}, nullable=${isNullable}`);

  // Test Prisma relations
  try {
    const storyWithRelations = await prisma.story.findFirst({
      include: {
        worktrees: true,
        testQueueEntries: true,
        pullRequests: true
      }
    });

    const hasWorktrees = Array.isArray(storyWithRelations?.worktrees);
    const hasQueue = Array.isArray(storyWithRelations?.testQueueEntries);
    const hasPRs = Array.isArray(storyWithRelations?.pullRequests);

    addResult(
      'Story.worktrees relation',
      hasWorktrees ? 'PASS' : 'FAIL',
      'array',
      hasWorktrees ? 'array' : 'not accessible'
    );

    addResult(
      'Story.testQueueEntries relation',
      hasQueue ? 'PASS' : 'FAIL',
      'array',
      hasQueue ? 'array' : 'not accessible'
    );

    addResult(
      'Story.pullRequests relation',
      hasPRs ? 'PASS' : 'FAIL',
      'array',
      hasPRs ? 'array' : 'not accessible'
    );

    console.log(`✓ Prisma relations accessible: worktrees=${hasWorktrees}, queue=${hasQueue}, PRs=${hasPRs}`);
  } catch (error) {
    console.error(`✗ Error testing Prisma relations: ${error.message}`);
    addResult('Prisma relations', 'FAIL', 'accessible', 'error', error.message);
  }
}

async function validateIndexes() {
  console.log('\n========================================');
  console.log('4. INDEX VALIDATION');
  console.log('========================================\n');

  const indexes = await prisma.$queryRaw<any[]>`
    SELECT tablename, indexname
    FROM pg_indexes
    WHERE tablename IN ('worktrees', 'test_queue', 'pull_requests')
    ORDER BY tablename, indexname;
  `;

  const worktreeIndexes = indexes.filter(i => i.tablename === 'worktrees').map(i => i.indexname);
  const queueIndexes = indexes.filter(i => i.tablename === 'test_queue').map(i => i.indexname);
  const prIndexes = indexes.filter(i => i.tablename === 'pull_requests').map(i => i.indexname);

  console.log(`✓ Worktree indexes (${worktreeIndexes.length}): ${worktreeIndexes.join(', ')}`);
  console.log(`✓ TestQueue indexes (${queueIndexes.length}): ${queueIndexes.join(', ')}`);
  console.log(`✓ PullRequest indexes (${prIndexes.length}): ${prIndexes.join(', ')}`);

  // Expected minimum: 3 PKs + 12 custom indexes = 15 total
  const totalIndexes = indexes.length;
  const expectedMin = 12; // Custom indexes (PKs counted separately)

  addResult(
    'Total indexes created',
    totalIndexes >= expectedMin ? 'PASS' : 'FAIL',
    `>=${expectedMin}`,
    totalIndexes
  );
}

async function validateForeignKeys() {
  console.log('\n========================================');
  console.log('5. FOREIGN KEY CONSTRAINT VALIDATION');
  console.log('========================================\n');

  const fkConstraints = await prisma.$queryRaw<any[]>`
    SELECT
      conname AS constraint_name,
      conrelid::regclass AS table_name,
      confdeltype
    FROM pg_constraint
    WHERE conname LIKE '%story_id_fkey%'
    AND conrelid::regclass::text IN ('worktrees', 'test_queue', 'pull_requests');
  `;

  const totalFKs = fkConstraints.length;
  const allCascade = fkConstraints.every(fk => fk.confdeltype === 'c');

  addResult(
    'Foreign key constraints count',
    totalFKs === 3 ? 'PASS' : 'FAIL',
    3,
    totalFKs
  );

  addResult(
    'All FKs have CASCADE delete',
    allCascade ? 'PASS' : 'FAIL',
    'all CASCADE',
    allCascade ? 'all CASCADE' : 'mixed'
  );

  fkConstraints.forEach(fk => {
    const deleteType = fk.confdeltype === 'c' ? 'CASCADE' : 'OTHER';
    console.log(`✓ ${fk.table_name}.${fk.constraint_name}: ON DELETE ${deleteType}`);
  });
}

async function validateCascadeDelete() {
  console.log('\n========================================');
  console.log('6. CASCADE DELETE BEHAVIOR TEST');
  console.log('========================================\n');

  try {
    // Get test project and user
    const project = await prisma.project.findFirst();
    const user = await prisma.user.findFirst();

    if (!project || !user) {
      console.log('⚠ Skipping cascade delete test: no project/user found');
      addResult('Cascade delete test', 'FAIL', 'tested', 'skipped', 'No test data available');
      return;
    }

    // Create test story
    const testStory = await prisma.story.create({
      data: {
        projectId: project.id,
        key: `TEST-CASCADE-${Date.now()}`,
        title: 'Test Story for Cascade Delete',
        createdById: user.id
      }
    });

    // Create related records
    const worktree = await prisma.worktree.create({
      data: {
        storyId: testStory.id,
        branchName: 'test-cascade',
        worktreePath: '/tmp/test-cascade'
      }
    });

    const queueEntry = await prisma.testQueue.create({
      data: {
        storyId: testStory.id,
        position: 100,
        submittedBy: 'test-cascade'
      }
    });

    const pr = await prisma.pullRequest.create({
      data: {
        storyId: testStory.id,
        prNumber: 999999,
        prUrl: 'https://github.com/test/test/pull/999999',
        title: 'Test Cascade PR'
      }
    });

    console.log(`✓ Created test story ${testStory.key} with 3 related records`);

    // Delete story
    await prisma.story.delete({
      where: { id: testStory.id }
    });

    console.log(`✓ Deleted test story ${testStory.key}`);

    // Verify cascade deletes
    const [worktreeAfter, queueAfter, prAfter] = await Promise.all([
      prisma.worktree.findUnique({ where: { id: worktree.id } }),
      prisma.testQueue.findUnique({ where: { id: queueEntry.id } }),
      prisma.pullRequest.findUnique({ where: { id: pr.id } })
    ]);

    const allDeleted = !worktreeAfter && !queueAfter && !prAfter;

    addResult(
      'Cascade delete worktrees',
      !worktreeAfter ? 'PASS' : 'FAIL',
      'deleted',
      worktreeAfter ? 'still exists' : 'deleted'
    );

    addResult(
      'Cascade delete test queue',
      !queueAfter ? 'PASS' : 'FAIL',
      'deleted',
      queueAfter ? 'still exists' : 'deleted'
    );

    addResult(
      'Cascade delete pull requests',
      !prAfter ? 'PASS' : 'FAIL',
      'deleted',
      prAfter ? 'still exists' : 'deleted'
    );

    console.log(`✓ Cascade delete: worktree=${!worktreeAfter}, queue=${!queueAfter}, pr=${!prAfter}`);

    if (allDeleted) {
      console.log('✅ Cascade delete test PASSED');
    } else {
      console.log('❌ Cascade delete test FAILED');
    }
  } catch (error) {
    console.error(`✗ Cascade delete test error: ${error.message}`);
    addResult('Cascade delete test', 'FAIL', 'passed', 'error', error.message);
  }
}

async function printSummary() {
  console.log('\n========================================');
  console.log('VALIDATION SUMMARY');
  console.log('========================================\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\nFailed Tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ ${r.test}`);
      console.log(`     Expected: ${r.expected}`);
      console.log(`     Actual: ${r.actual}`);
      if (r.message) console.log(`     Message: ${r.message}`);
    });
  }

  console.log('\n========================================');
  console.log('ACCEPTANCE CRITERIA STATUS');
  console.log('========================================\n');

  const criteria = [
    { id: 'AC-SCHEMA-001', name: 'Worktree table structure', passed: results.find(r => r.test === 'Worktree table columns')?.status === 'PASS' },
    { id: 'AC-SCHEMA-002', name: 'TestQueue table structure', passed: results.find(r => r.test === 'TestQueue table columns')?.status === 'PASS' },
    { id: 'AC-SCHEMA-003', name: 'PullRequest table structure', passed: results.find(r => r.test === 'PullRequest table columns')?.status === 'PASS' },
    { id: 'AC-SCHEMA-004', name: 'Enum definitions', passed: results.filter(r => r.test.includes('enum')).every(r => r.status === 'PASS') },
    { id: 'AC-SCHEMA-005', name: 'Story model extensions', passed: results.find(r => r.test === 'Story.currentPhase field exists')?.status === 'PASS' },
    { id: 'AC-MIGRATION-003', name: 'Foreign key constraints', passed: results.find(r => r.test === 'Foreign key constraints count')?.status === 'PASS' },
    { id: 'AC-MIGRATION-004', name: 'Indexes created', passed: results.find(r => r.test === 'Total indexes created')?.status === 'PASS' },
    { id: 'AC-REL-001/002/003', name: 'Cascade delete behavior', passed: results.filter(r => r.test.includes('Cascade delete')).every(r => r.status === 'PASS') }
  ];

  criteria.forEach(c => {
    console.log(`${c.passed ? '✅' : '❌'} ${c.id}: ${c.name}`);
  });

  const allPassed = criteria.every(c => c.passed);

  console.log('\n========================================');
  if (allPassed) {
    console.log('✅ ALL ACCEPTANCE CRITERIA MET');
  } else {
    console.log('❌ SOME ACCEPTANCE CRITERIA NOT MET');
  }
  console.log('========================================\n');
}

async function main() {
  console.log('========================================');
  console.log('ST-38: Database Schema Validation');
  console.log('Epic: EP-7 - Git Workflow Agent');
  console.log('========================================');

  try {
    await validateEnums();
    await validateTables();
    await validateStoryExtension();
    await validateIndexes();
    await validateForeignKeys();
    await validateCascadeDelete();
    await printSummary();
  } catch (error) {
    console.error('Validation error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
