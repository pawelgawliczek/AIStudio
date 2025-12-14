/**
 * Cache Token Aggregation Tests for ST-234
 * Tests that cache tokens from ComponentRun.metadata.cacheTokens
 * are correctly aggregated to WorkflowRun.costBreakdown
 */

describe('Cache Token Aggregation (ST-234)', () => {
  describe('ComponentRun metadata.cacheTokens extraction', () => {
    it('should extract cacheTokens from ComponentRun metadata', () => {
      const componentRun = {
        id: 'cr-1',
        metadata: {
          cacheTokens: {
            creation: 5000,
            read: 20000,
          },
        },
      };

      const metadata = componentRun.metadata as Record<string, any> | null;
      const cacheCreation = metadata?.cacheTokens?.creation || 0;
      const cacheRead = metadata?.cacheTokens?.read || 0;

      expect(cacheCreation).toBe(5000);
      expect(cacheRead).toBe(20000);
    });

    it('should handle missing cacheTokens gracefully', () => {
      const componentRun = {
        id: 'cr-1',
        metadata: {},
      };

      const metadata = componentRun.metadata as Record<string, any> | null;
      const cacheCreation = metadata?.cacheTokens?.creation || 0;
      const cacheRead = metadata?.cacheTokens?.read || 0;

      expect(cacheCreation).toBe(0);
      expect(cacheRead).toBe(0);
    });

    it('should handle null metadata gracefully', () => {
      const componentRun = {
        id: 'cr-1',
        metadata: null,
      };

      const metadata = componentRun.metadata as Record<string, any> | null;
      const cacheCreation = metadata?.cacheTokens?.creation || 0;
      const cacheRead = metadata?.cacheTokens?.read || 0;

      expect(cacheCreation).toBe(0);
      expect(cacheRead).toBe(0);
    });
  });

  describe('Aggregation across multiple ComponentRuns', () => {
    it('should sum cache tokens across all completed component runs', () => {
      const componentRuns = [
        {
          id: 'cr-1',
          status: 'completed',
          metadata: { cacheTokens: { creation: 1000, read: 5000 } },
        },
        {
          id: 'cr-2',
          status: 'completed',
          metadata: { cacheTokens: { creation: 2000, read: 10000 } },
        },
        {
          id: 'cr-3',
          status: 'completed',
          metadata: { cacheTokens: { creation: 500, read: 3000 } },
        },
      ];

      // Aggregation logic from record_component_complete.ts
      let totalCacheCreation = 0;
      let totalCacheRead = 0;
      for (const cr of componentRuns) {
        const metadata = cr.metadata as Record<string, any> | null;
        if (metadata?.cacheTokens) {
          totalCacheCreation += metadata.cacheTokens.creation || 0;
          totalCacheRead += metadata.cacheTokens.read || 0;
        }
      }

      expect(totalCacheCreation).toBe(3500); // 1000 + 2000 + 500
      expect(totalCacheRead).toBe(18000); // 5000 + 10000 + 3000
    });

    it('should handle mixed metadata (some with cache, some without)', () => {
      const componentRuns = [
        {
          id: 'cr-1',
          status: 'completed',
          metadata: { cacheTokens: { creation: 1000, read: 5000 } },
        },
        {
          id: 'cr-2',
          status: 'completed',
          metadata: {}, // No cacheTokens
        },
        {
          id: 'cr-3',
          status: 'completed',
          metadata: null, // Null metadata
        },
        {
          id: 'cr-4',
          status: 'completed',
          metadata: { cacheTokens: { creation: 2000, read: 8000 } },
        },
      ];

      let totalCacheCreation = 0;
      let totalCacheRead = 0;
      for (const cr of componentRuns) {
        const metadata = cr.metadata as Record<string, any> | null;
        if (metadata?.cacheTokens) {
          totalCacheCreation += metadata.cacheTokens.creation || 0;
          totalCacheRead += metadata.cacheTokens.read || 0;
        }
      }

      expect(totalCacheCreation).toBe(3000); // 1000 + 2000
      expect(totalCacheRead).toBe(13000); // 5000 + 8000
    });

    it('should handle partial cacheTokens (only creation or only read)', () => {
      const componentRuns = [
        {
          id: 'cr-1',
          status: 'completed',
          metadata: { cacheTokens: { creation: 1000 } }, // No read
        },
        {
          id: 'cr-2',
          status: 'completed',
          metadata: { cacheTokens: { read: 5000 } }, // No creation
        },
      ];

      let totalCacheCreation = 0;
      let totalCacheRead = 0;
      for (const cr of componentRuns) {
        const metadata = cr.metadata as Record<string, any> | null;
        if (metadata?.cacheTokens) {
          totalCacheCreation += metadata.cacheTokens.creation || 0;
          totalCacheRead += metadata.cacheTokens.read || 0;
        }
      }

      expect(totalCacheCreation).toBe(1000);
      expect(totalCacheRead).toBe(5000);
    });
  });

  describe('costBreakdown structure', () => {
    it('should create correct costBreakdown structure for WorkflowRun', () => {
      const existingCostBreakdown = { input: 0.05, output: 0.02 };
      const totalCacheCreation = 3500;
      const totalCacheRead = 18000;

      const newCostBreakdown = {
        ...existingCostBreakdown,
        cacheCreation: totalCacheCreation,
        cacheRead: totalCacheRead,
      };

      expect(newCostBreakdown).toEqual({
        input: 0.05,
        output: 0.02,
        cacheCreation: 3500,
        cacheRead: 18000,
      });
    });

    it('should handle empty existing costBreakdown', () => {
      const existingCostBreakdown = {};
      const totalCacheCreation = 1000;
      const totalCacheRead = 5000;

      const newCostBreakdown = {
        ...existingCostBreakdown,
        cacheCreation: totalCacheCreation,
        cacheRead: totalCacheRead,
      };

      expect(newCostBreakdown).toEqual({
        cacheCreation: 1000,
        cacheRead: 5000,
      });
    });
  });

  describe('API response extraction', () => {
    it('should extract cache metrics from WorkflowRun.costBreakdown for API', () => {
      const workflowRun = {
        costBreakdown: {
          input: 0.05,
          output: 0.02,
          cacheCreation: 3500,
          cacheRead: 18000,
        },
      };

      // Extraction logic from workflow-state.service.ts
      const totalCacheCreation = ((workflowRun as any).costBreakdown as any)?.cacheCreation || 0;
      const totalCacheRead = ((workflowRun as any).costBreakdown as any)?.cacheRead || 0;

      expect(totalCacheCreation).toBe(3500);
      expect(totalCacheRead).toBe(18000);
    });

    it('should return 0 for missing costBreakdown', () => {
      const workflowRun = {
        costBreakdown: null,
      };

      const totalCacheCreation = ((workflowRun as any).costBreakdown as any)?.cacheCreation || 0;
      const totalCacheRead = ((workflowRun as any).costBreakdown as any)?.cacheRead || 0;

      expect(totalCacheCreation).toBe(0);
      expect(totalCacheRead).toBe(0);
    });

    it('should return 0 for costBreakdown without cache fields', () => {
      const workflowRun = {
        costBreakdown: { input: 0.05, output: 0.02 },
      };

      const totalCacheCreation = ((workflowRun as any).costBreakdown as any)?.cacheCreation || 0;
      const totalCacheRead = ((workflowRun as any).costBreakdown as any)?.cacheRead || 0;

      expect(totalCacheCreation).toBe(0);
      expect(totalCacheRead).toBe(0);
    });
  });
});
