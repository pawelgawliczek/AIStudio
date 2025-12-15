import { Injectable } from '@nestjs/common';
import { ComprehensiveMetricsDto } from '../dto/metrics.dto';

@Injectable()
export class ComprehensiveMetricsCalculator {
  /**
   * Calculate comprehensive metrics from workflow runs
   */
  calculateComprehensiveMetrics(workflowRuns: any[]): ComprehensiveMetricsDto {
    const allComponentRuns = workflowRuns.flatMap((wr) => wr.componentRuns);
    const uniqueStories = new Set(workflowRuns.map((wr) => wr.storyId).filter(Boolean));

    // Token metrics
    const inputTokens = allComponentRuns.reduce((sum, cr) => sum + (cr.tokensInput || 0), 0);
    const outputTokens = allComponentRuns.reduce((sum, cr) => sum + (cr.tokensOutput || 0), 0);
    const cacheRead = allComponentRuns.reduce((sum, cr) => sum + (cr.tokensCacheRead || 0), 0);
    const cacheWrite = allComponentRuns.reduce((sum, cr) => sum + (cr.tokensCacheWrite || 0), 0);
    const cacheHits = allComponentRuns.reduce((sum, cr) => sum + (cr.cacheHits || 0), 0);
    const cacheMisses = allComponentRuns.reduce((sum, cr) => sum + (cr.cacheMisses || 0), 0);
    const cacheHitRate = cacheHits + cacheMisses > 0 ? cacheHits / (cacheHits + cacheMisses) : 0;

    // Code impact
    const linesAdded = allComponentRuns.reduce((sum, cr) => sum + (cr.linesAdded || 0), 0);
    const linesModified = allComponentRuns.reduce((sum, cr) => sum + (cr.linesModified || 0), 0);
    const linesDeleted = allComponentRuns.reduce((sum, cr) => sum + (cr.linesDeleted || 0), 0);
    const testsAdded = allComponentRuns.reduce((sum, cr) => sum + (cr.testsAdded || 0), 0);
    const filesModified = allComponentRuns.reduce(
      (sum, cr) => sum + ((cr.filesModified as string[])?.length || 0),
      0,
    );

    // Execution metrics
    const totalDurationSeconds = allComponentRuns.reduce(
      (sum, cr) => sum + (cr.durationSeconds || 0),
      0,
    );
    const totalPrompts = allComponentRuns.reduce((sum, cr) => sum + (cr.userPrompts || 0), 0);
    const totalIterations = allComponentRuns.reduce(
      (sum, cr) => sum + (cr.systemIterations || 0),
      0,
    );
    const totalInteractions = allComponentRuns.reduce(
      (sum, cr) => sum + (cr.humanInterventions || 0),
      0,
    );

    // ST-147: Turn tracking metrics
    const totalTurns = allComponentRuns.reduce((sum, cr) => sum + (cr.totalTurns || 0), 0);
    const totalManualPrompts = allComponentRuns.reduce((sum, cr) => sum + (cr.manualPrompts || 0), 0);
    const totalAutoContinues = allComponentRuns.reduce((sum, cr) => sum + (cr.autoContinues || 0), 0);

    // Cost calculation
    const totalCost = allComponentRuns.reduce((sum, cr) => sum + (Number(cr.cost) || 0), 0);
    const storiesCount = uniqueStories.size || 1;
    const totalLOC = linesAdded + linesModified;

    // Efficiency ratios
    const tokensPerLOC = totalLOC > 0 ? (inputTokens + outputTokens) / totalLOC : 0;
    const promptsPerStory = storiesCount > 0 ? totalPrompts / storiesCount : 0;
    const interactionsPerStory = storiesCount > 0 ? totalInteractions / storiesCount : 0;
    // ST-147: Turn-based efficiency metrics
    const turnsPerStory = storiesCount > 0 ? totalTurns / storiesCount : 0;
    const manualPromptsPerStory = storiesCount > 0 ? totalManualPrompts / storiesCount : 0;
    const automationRate = totalTurns > 0 ? (totalAutoContinues / totalTurns) * 100 : 0;
    const defectsPerStory = 0; // Would need to query defects table
    const codeChurnPercent = 0; // Would need historical data
    const testCoveragePercent = 0; // Would need coverage data
    const defectLeakagePercent = 0;

    // Cost value metrics
    const costPerStory = storiesCount > 0 ? totalCost / storiesCount : 0;
    const costPerAcceptedLOC = totalLOC > 0 ? totalCost / totalLOC : 0;
    const reworkCost = totalCost * (codeChurnPercent / 100);
    const netCost = totalCost + reworkCost;

    return {
      tokens: {
        inputTokens,
        outputTokens,
        cacheRead,
        cacheWrite,
        totalTokens: inputTokens + outputTokens,
        cacheHitRate,
      },
      efficiency: {
        tokensPerLOC,
        promptsPerStory,
        interactionsPerStory,
        defectsPerStory,
        defectLeakagePercent,
        codeChurnPercent,
        testCoveragePercent,
        // ST-147: Turn-based metrics
        turnsPerStory,
        manualPromptsPerStory,
        automationRate,
        // Legacy fields (for backward compatibility)
        avgTokensPerStory: 0,
        avgTokenPerLoc: 0,
        storyCycleTimeHours: 0,
        promptIterationsPerStory: 0,
        parallelizationEfficiencyPercent: 0,
        tokenEfficiencyRatio: 0,
      },
      costValue: {
        costPerStory,
        costPerAcceptedLoc: costPerAcceptedLOC,
        storiesCompleted: storiesCount,
        netCost,
        reworkCost,
        acceptedLoc: totalLOC,
      },
      codeImpact: {
        linesAdded,
        linesModified,
        linesDeleted,
        testsAdded,
        filesModified,
      },
      execution: {
        totalRuns: workflowRuns.length,
        totalDurationSeconds,
        avgDurationPerRun:
          workflowRuns.length > 0 ? totalDurationSeconds / workflowRuns.length : 0,
        totalPrompts,
        totalInteractions,
        totalIterations,
        // ST-147: Turn-based execution metrics
        totalTurns,
        totalManualPrompts,
        totalAutoContinues,
      },
    };
  }
}
