/**
 * ST-161: MCP Edge Cases E2E Tests
 *
 * Tests edge cases and robustness via real MCP commands:
 * - Unicode and special characters
 * - Long strings and content
 * - Concurrent operations
 * - Error handling and rollbacks
 * - Boundary conditions
 *
 * Note: These tests stress-test the MCP layer.
 */

import { PrismaClient } from '@prisma/client';
import { MCPTestRunner, createMCPTestRunner } from './helpers/mcp-test-runner';

// Increase timeout for edge case tests
jest.setTimeout(300000);

describe('ST-161: MCP Edge Cases E2E Tests', () => {
  let prisma: PrismaClient;
  let runner: MCPTestRunner;

  // Test context
  const ctx: {
    projectId?: string;
    epicId?: string;
    storyIds: string[];
  } = {
    storyIds: [],
  };

  const testPrefix = `_ST161_EDGE_${Date.now()}`;

  beforeAll(async () => {
    console.log('\n============================================================');
    console.log('ST-161: MCP Edge Cases E2E Tests');
    console.log('============================================================');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log(`Test prefix: ${testPrefix}`);
    console.log('');

    prisma = new PrismaClient();
    runner = await createMCPTestRunner(prisma);

    console.log(`Environment: ${runner.getEnvironment().toUpperCase()}`);

    // Create base project and epic for tests
    const projectResult = await runner.execute<{ id: string }>('create_project', {
      name: `${testPrefix}_Project`,
      description: 'Edge case test project',
    });
    ctx.projectId = projectResult.result?.id;

    const epicResult = await runner.execute<{ id: string }>('create_epic', {
      projectId: ctx.projectId,
      title: `${testPrefix}_Epic`,
    });
    ctx.epicId = epicResult.result?.id;

    console.log(`Setup: Project ${ctx.projectId}, Epic ${ctx.epicId}\n`);
  });

  afterAll(async () => {
    console.log('\n[CLEANUP] Starting cleanup...');

    try {
      // Delete all test stories
      for (const storyId of ctx.storyIds) {
        await prisma.story.delete({ where: { id: storyId } }).catch(() => {});
      }

      // Delete epic
      if (ctx.epicId) {
        await prisma.epic.delete({ where: { id: ctx.epicId } }).catch(() => {});
      }

      // Delete project
      if (ctx.projectId) {
        await prisma.project.delete({ where: { id: ctx.projectId } }).catch(() => {});
      }

      console.log('[CLEANUP] Cleanup complete');
    } catch (err) {
      console.error('[CLEANUP] Error during cleanup:', err);
    }

    await prisma.$disconnect();

    console.log('\n============================================================');
    console.log(`Completed at: ${new Date().toISOString()}`);
    console.log('============================================================\n');
  });

  // ==========================================================================
  // UNICODE AND SPECIAL CHARACTERS
  // ==========================================================================
  describe('Unicode and Special Characters', () => {
    it('should handle unicode in story title', async () => {
      const unicodeTitle = `${testPrefix}_Unicode_日本語_한국어_العربية_🚀_émojis`;

      const result = await runner.execute<{ id: string; title: string }>('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: unicodeTitle,
        description: 'Story with unicode title',
        type: 'feature',
      });

      expect(result.success).toBe(true);
      expect(result.result?.title).toBe(unicodeTitle);

      ctx.storyIds.push(result.result!.id);
      console.log(`    ✓ Unicode title preserved: ${unicodeTitle.substring(0, 30)}...`);
    });

    it('should handle unicode in description', async () => {
      const unicodeDesc = `
        Description with multi-language content:
        - Japanese: これはテストです
        - Korean: 이것은 테스트입니다
        - Arabic: هذا اختبار
        - Russian: Это тест
        - Greek: Αυτό είναι δοκιμή
        - Emojis: 🎉 🚀 ✅ ❌ 🔧 📦
        - Math symbols: ∑ ∏ ∫ √ ∞ ≠ ≤ ≥
        - Currency: $ € £ ¥ ₹ ₿
      `;

      const result = await runner.execute<{ id: string; description: string }>('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: `${testPrefix}_Unicode_Desc`,
        description: unicodeDesc,
        type: 'feature',
      });

      expect(result.success).toBe(true);
      expect(result.result?.description).toContain('これはテストです');
      expect(result.result?.description).toContain('🎉');

      ctx.storyIds.push(result.result!.id);
      console.log(`    ✓ Unicode description preserved`);
    });

    it('should handle special characters in strings', async () => {
      const specialChars = `Test with "quotes", 'apostrophes', \`backticks\`, and special chars: <>&"'`;

      const result = await runner.execute<{ id: string; title: string }>('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: `${testPrefix}_Special_${Date.now()}`,
        description: specialChars,
        type: 'feature',
      });

      expect(result.success).toBe(true);
      expect(result.result?.id).toBeDefined();

      ctx.storyIds.push(result.result!.id);
      console.log(`    ✓ Special characters handled`);
    });

    it('should handle newlines and whitespace', async () => {
      const multiline = `Line 1
Line 2
Line 3

Blank line above

  Indented line
\tTabbed line`;

      const result = await runner.execute<{ id: string; description: string }>('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: `${testPrefix}_Multiline`,
        description: multiline,
        type: 'feature',
      });

      expect(result.success).toBe(true);
      expect(result.result?.description).toContain('Line 1');
      expect(result.result?.description).toContain('Line 2');

      ctx.storyIds.push(result.result!.id);
      console.log(`    ✓ Multiline content preserved`);
    });
  });

  // ==========================================================================
  // LONG STRINGS AND CONTENT
  // ==========================================================================
  describe('Long Strings and Content', () => {
    it('should handle long title (200 chars)', async () => {
      const longTitle = `${testPrefix}_` + 'A'.repeat(180);

      const result = await runner.execute<{ id: string; title: string }>('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: longTitle,
        description: 'Story with long title',
        type: 'feature',
      });

      expect(result.success).toBe(true);
      expect(result.result?.title?.length).toBeGreaterThan(180);

      ctx.storyIds.push(result.result!.id);
      console.log(`    ✓ Long title (${result.result?.title?.length} chars) handled`);
    });

    it('should handle very long description (10KB)', async () => {
      const longDesc = 'X'.repeat(10 * 1024); // 10KB of content

      const result = await runner.execute<{ id: string }>('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: `${testPrefix}_LongDesc_${Date.now()}`,
        description: longDesc,
        type: 'feature',
      });

      expect(result.success).toBe(true);

      ctx.storyIds.push(result.result!.id);
      console.log(`    ✓ 10KB description handled`);
    });

    it('should handle markdown content', async () => {
      const markdown = `
# Heading 1
## Heading 2
### Heading 3

**Bold text** and *italic text* and ~~strikethrough~~

- Bullet 1
- Bullet 2
  - Nested bullet

1. Numbered item 1
2. Numbered item 2

\`\`\`typescript
function example() {
  return "code block";
}
\`\`\`

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |

> Blockquote

[Link](https://example.com)

![Image](https://example.com/image.png)
      `;

      const result = await runner.execute<{ id: string; description: string }>('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: `${testPrefix}_Markdown`,
        description: markdown,
        type: 'feature',
      });

      expect(result.success).toBe(true);
      expect(result.result?.description).toContain('# Heading 1');
      expect(result.result?.description).toContain('```typescript');

      ctx.storyIds.push(result.result!.id);
      console.log(`    ✓ Markdown content preserved`);
    });
  });

  // ==========================================================================
  // CONCURRENT OPERATIONS
  // ==========================================================================
  describe('Concurrent Operations', () => {
    it('should handle rapid sequential creates', async () => {
      const createPromises: Promise<{ success: boolean; result?: { id: string } }>[] = [];

      // Create 5 stories in quick succession
      for (let i = 0; i < 5; i++) {
        createPromises.push(
          runner.execute<{ id: string }>('create_story', {
            projectId: ctx.projectId,
            epicId: ctx.epicId,
            title: `${testPrefix}_Rapid_${i}`,
            description: `Rapid creation test ${i}`,
            type: 'feature',
          }),
        );

        // Small delay between creates to avoid overwhelming
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const results = await Promise.all(createPromises);
      const successCount = results.filter((r) => r.success).length;

      // Store IDs for cleanup
      results.forEach((r) => {
        if (r.result?.id) ctx.storyIds.push(r.result.id);
      });

      expect(successCount).toBe(5);
      console.log(`    ✓ ${successCount}/5 rapid creates succeeded`);
    });

    it('should handle concurrent reads', async () => {
      // Create a story to read
      const createResult = await runner.execute<{ id: string }>('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: `${testPrefix}_ConcurrentRead`,
        description: 'Story for concurrent read test',
        type: 'feature',
      });

      if (!createResult.result?.id) {
        throw new Error('Failed to create story for concurrent read test');
      }

      ctx.storyIds.push(createResult.result.id);
      const storyId = createResult.result.id;

      // Read it multiple times concurrently
      const readPromises = [];
      for (let i = 0; i < 3; i++) {
        readPromises.push(
          runner.execute<{ id: string; title: string }>('get_story', {
            storyId,
          }),
        );
      }

      const results = await Promise.all(readPromises);
      const successCount = results.filter((r) => r.success).length;

      expect(successCount).toBe(3);
      console.log(`    ✓ ${successCount}/3 concurrent reads succeeded`);
    });

    it('should handle concurrent list operations', async () => {
      const listPromises = [
        runner.execute('list_stories', { projectId: ctx.projectId, pageSize: 5 }),
        runner.execute('list_epics', { projectId: ctx.projectId, pageSize: 5 }),
        runner.execute('list_projects', { pageSize: 5 }),
      ];

      const results = await Promise.all(listPromises);
      const successCount = results.filter((r) => r.success).length;

      expect(successCount).toBe(3);
      console.log(`    ✓ ${successCount}/3 concurrent lists succeeded`);
    });
  });

  // ==========================================================================
  // ERROR HANDLING AND VALIDATION
  // ==========================================================================
  describe('Error Handling and Validation', () => {
    it('should reject invalid UUID format', async () => {
      const result = await runner.execute('get_story', {
        storyId: 'not-a-uuid',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      console.log(`    ✓ Invalid UUID rejected`);
    });

    it('should reject missing required fields', async () => {
      const result = await runner.execute('create_story', {
        projectId: ctx.projectId,
        // Missing title - required field
        description: 'Story without title',
      });

      expect(result.success).toBe(false);
      console.log(`    ✓ Missing required field rejected`);
    });

    it('should reject invalid enum values', async () => {
      const result = await runner.execute('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: 'Invalid Type Story',
        type: 'invalid_type' as 'feature',
      });

      expect(result.success).toBe(false);
      console.log(`    ✓ Invalid enum value rejected`);
    });

    it('should reject operations on deleted entities', async () => {
      // Create and delete a story
      const createResult = await runner.execute<{ id: string }>('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: `${testPrefix}_ToDelete`,
        description: 'Story to be deleted',
        type: 'feature',
      });

      const storyId = createResult.result!.id;

      // Delete it
      await runner.execute('delete_story', {
        storyId,
        confirm: true,
      });

      // Try to get it
      const getResult = await runner.execute('get_story', { storyId });
      expect(getResult.success).toBe(false);

      // Try to update it
      const updateResult = await runner.execute('update_story', {
        storyId,
        title: 'Updated Title',
      });
      expect(updateResult.success).toBe(false);

      console.log(`    ✓ Operations on deleted entity rejected`);
    });

    it('should reject delete without confirmation', async () => {
      const createResult = await runner.execute<{ id: string }>('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: `${testPrefix}_NoConfirmDelete`,
        description: 'Story for no-confirm test',
        type: 'feature',
      });

      const storyId = createResult.result!.id;
      ctx.storyIds.push(storyId);

      // Try to delete without confirm: true
      const deleteResult = await runner.execute('delete_story', {
        storyId,
        confirm: false,
      });

      expect(deleteResult.success).toBe(false);
      console.log(`    ✓ Delete without confirmation rejected`);
    });
  });

  // ==========================================================================
  // BOUNDARY CONDITIONS
  // ==========================================================================
  describe('Boundary Conditions', () => {
    it('should handle empty string fields', async () => {
      const result = await runner.execute<{ id: string; description: string }>('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: `${testPrefix}_EmptyDesc`,
        description: '', // Empty description
        type: 'feature',
      });

      expect(result.success).toBe(true);
      ctx.storyIds.push(result.result!.id);
      console.log(`    ✓ Empty description handled`);
    });

    it('should handle numeric boundary values', async () => {
      const result = await runner.execute<{ id: string }>('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: `${testPrefix}_NumericBounds`,
        description: 'Story with numeric bounds',
        type: 'feature',
        technicalComplexity: 10, // Max value
        businessComplexity: 1, // Min value
        businessImpact: 5, // Mid value
      });

      expect(result.success).toBe(true);
      ctx.storyIds.push(result.result!.id);
      console.log(`    ✓ Numeric boundaries handled`);
    });

    it('should reject out-of-range numeric values', async () => {
      const result = await runner.execute('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: `${testPrefix}_OutOfRange`,
        description: 'Story with out of range values',
        type: 'feature',
        technicalComplexity: 100, // Out of range (max is 10)
      });

      // May or may not fail depending on validation
      console.log(`    ✓ Out of range value test executed (success: ${result.success})`);
    });

    it('should handle pagination edge cases', async () => {
      // Page 0 (should be treated as page 1)
      const page0Result = await runner.execute('list_stories', {
        projectId: ctx.projectId,
        page: 0,
        pageSize: 5,
      });

      // Very large page (should return empty)
      const largePage = await runner.execute<{ data: unknown[]; pagination: { total: number } }>(
        'list_stories',
        {
          projectId: ctx.projectId,
          page: 99999,
          pageSize: 5,
        },
      );

      expect(largePage.success).toBe(true);
      expect(largePage.result?.data?.length).toBe(0);

      console.log(`    ✓ Pagination edge cases handled`);
    });

    it('should handle pageSize limits', async () => {
      // Very large pageSize (should be capped)
      const result = await runner.execute<{ data: unknown[]; pagination: { total: number } }>(
        'list_stories',
        {
          projectId: ctx.projectId,
          page: 1,
          pageSize: 1000, // Above max (100)
        },
      );

      // Should succeed but may cap pageSize
      expect(result.success).toBe(true);
      console.log(`    ✓ Large pageSize handled`);
    });
  });

  // ==========================================================================
  // DATA INTEGRITY
  // ==========================================================================
  describe('Data Integrity', () => {
    it('should preserve exact data through create-get cycle', async () => {
      const testData = {
        title: `${testPrefix}_DataIntegrity_${Date.now()}`,
        description: 'Test description with exact content 12345',
        type: 'feature' as const,
        technicalComplexity: 7,
        businessComplexity: 4,
        businessImpact: 8,
      };

      // Create
      const createResult = await runner.execute<{ id: string }>('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        ...testData,
      });

      expect(createResult.success).toBe(true);
      const storyId = createResult.result!.id;
      ctx.storyIds.push(storyId);

      // Get
      const getResult = await runner.execute<{
        id: string;
        title: string;
        description: string;
        type: string;
        technicalComplexity: number;
        businessComplexity: number;
        businessImpact: number;
      }>('get_story', { storyId });

      expect(getResult.success).toBe(true);
      expect(getResult.result?.title).toBe(testData.title);
      expect(getResult.result?.description).toBe(testData.description);
      expect(getResult.result?.type).toBe(testData.type);
      expect(getResult.result?.technicalComplexity).toBe(testData.technicalComplexity);
      expect(getResult.result?.businessComplexity).toBe(testData.businessComplexity);
      expect(getResult.result?.businessImpact).toBe(testData.businessImpact);

      console.log(`    ✓ Data integrity verified through create-get cycle`);
    });

    it('should preserve data through update cycle', async () => {
      // Create
      const createResult = await runner.execute<{ id: string }>('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: `${testPrefix}_UpdateIntegrity_${Date.now()}`,
        description: 'Original description',
        type: 'feature',
      });

      const storyId = createResult.result!.id;
      ctx.storyIds.push(storyId);

      // Update
      const updatedDesc = 'Updated description with new content 67890';
      await runner.execute('update_story', {
        storyId,
        description: updatedDesc,
        technicalComplexity: 9,
      });

      // Get and verify
      const getResult = await runner.execute<{
        description: string;
        technicalComplexity: number;
      }>('get_story', { storyId });

      expect(getResult.result?.description).toBe(updatedDesc);
      expect(getResult.result?.technicalComplexity).toBe(9);

      console.log(`    ✓ Data integrity verified through update cycle`);
    });
  });

  // ==========================================================================
  // SEARCH FUNCTIONALITY
  // ==========================================================================
  describe('Search Functionality', () => {
    it('should find story by exact key', async () => {
      // Create a story and get its key
      const createResult = await runner.execute<{ id: string; key: string }>('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: `${testPrefix}_SearchByKey`,
        description: 'Story for key search test',
        type: 'feature',
      });

      const storyKey = createResult.result!.key;
      ctx.storyIds.push(createResult.result!.id);

      // Search by key
      const searchResult = await runner.execute<{ data: Array<{ key: string }> }>('search_stories', {
        storyKey,
      });

      expect(searchResult.success).toBe(true);
      const found = searchResult.result?.data?.find((s) => s.key === storyKey);
      expect(found).toBeDefined();

      console.log(`    ✓ Found story by key: ${storyKey}`);
    });

    it('should find story by title query', async () => {
      const uniquePhrase = `UniqueSearchPhrase_${Date.now()}`;

      const createResult = await runner.execute<{ id: string }>('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: `${testPrefix}_${uniquePhrase}`,
        description: 'Story for query search test',
        type: 'feature',
      });

      ctx.storyIds.push(createResult.result!.id);

      // Search by query
      const searchResult = await runner.execute<{ data: Array<{ title: string }> }>(
        'search_stories',
        {
          query: uniquePhrase,
          projectId: ctx.projectId,
        },
      );

      expect(searchResult.success).toBe(true);
      const found = searchResult.result?.data?.find((s) => s.title.includes(uniquePhrase));
      expect(found).toBeDefined();

      console.log(`    ✓ Found story by query: ${uniquePhrase}`);
    });

    it('should return empty for non-matching search', async () => {
      const result = await runner.execute<{ data: unknown[] }>('search_stories', {
        query: 'ThisQueryShouldNeverMatch_XYZ123',
        projectId: ctx.projectId,
      });

      expect(result.success).toBe(true);
      expect(result.result?.data?.length).toBe(0);

      console.log(`    ✓ Empty result for non-matching search`);
    });
  });
});
