/**
 * ST-242: Centralized Multi-Model Pricing Utility
 *
 * Claude API pricing (per million tokens) - from official Anthropic docs Dec 2025
 * Source: https://www.anthropic.com/pricing
 *
 * Cache pricing formula:
 * - Cache write = 1.25x base input price
 * - Cache read = 0.1x base input price
 */

export interface ModelPricing {
  input: number; // $ per million tokens
  output: number; // $ per million tokens
  cacheWrite: number; // $ per million tokens (1.25x input)
  cacheRead: number; // $ per million tokens (0.1x input)
}

export const CLAUDE_PRICING: Record<string, ModelPricing> = {
  // Claude 4.5 family
  'claude-opus-4-5': {
    input: 5.0,
    output: 25.0,
    cacheWrite: 6.25,
    cacheRead: 0.5,
  },

  // Claude 4.1 family (Opus)
  'claude-opus-4-1': {
    input: 15.0,
    output: 75.0,
    cacheWrite: 18.75,
    cacheRead: 1.5,
  },

  // Claude 4 family
  'claude-opus-4': {
    input: 15.0,
    output: 75.0,
    cacheWrite: 18.75,
    cacheRead: 1.5,
  },
  'claude-sonnet-4': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.3,
  },
  'claude-sonnet-4-5': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.3,
  },

  // Claude 3.5 family
  'claude-haiku-3-5': {
    input: 0.8,
    output: 4.0,
    cacheWrite: 1.0,
    cacheRead: 0.08,
  },
  'claude-haiku-4-5': {
    input: 1.0,
    output: 5.0,
    cacheWrite: 1.25,
    cacheRead: 0.1,
  },

  // Claude 3 family (legacy)
  'claude-haiku-3': {
    input: 0.25,
    output: 1.25,
    cacheWrite: 0.3,
    cacheRead: 0.03,
  },
  'claude-sonnet-3': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.3,
  },
  'claude-opus-3': {
    input: 15.0,
    output: 75.0,
    cacheWrite: 18.75,
    cacheRead: 1.5,
  },

  // Default fallback (Claude Sonnet 4 - most commonly used in Claude Code)
  default: {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.3,
  },
};

/**
 * Extract model family from a full model ID
 * Examples:
 *   "claude-sonnet-4-5-20250929" -> "claude-sonnet-4-5"
 *   "claude-opus-4-5-20251101" -> "claude-opus-4-5"
 *   "claude-3-5-haiku-20241022" -> "claude-haiku-3-5"
 */
export function getModelFamily(modelId?: string | null): string {
  if (!modelId) return 'default';

  // Handle new naming convention: claude-{tier}-{version}
  // e.g., claude-sonnet-4-5-20250929, claude-opus-4-5-20251101, claude-sonnet-4-20250514
  // Match: claude-{tier}-{major}[-{minor}] but stop before 8-digit date
  const newFormatMatch = modelId.match(
    /^claude-(opus|sonnet|haiku)-(\d+)(?:-(\d))?(?:-\d{8})?$/,
  );
  if (newFormatMatch) {
    const [, tier, major, minor] = newFormatMatch;
    return minor ? `claude-${tier}-${major}-${minor}` : `claude-${tier}-${major}`;
  }

  // Handle legacy naming: claude-3-5-{tier}-{date}
  // e.g., claude-3-5-haiku-20241022
  const legacyMatch = modelId.match(/^claude-(\d+)-(\d+)?-?(opus|sonnet|haiku)/);
  if (legacyMatch) {
    const [, major, minor, tier] = legacyMatch;
    return minor ? `claude-${tier}-${major}-${minor}` : `claude-${tier}-${major}`;
  }

  // Handle claude-3-{tier} format
  const claude3Match = modelId.match(/^claude-3-(opus|sonnet|haiku)/);
  if (claude3Match) {
    return `claude-${claude3Match[1]}-3`;
  }

  return 'default';
}

/**
 * Get pricing for a specific model
 */
export function getModelPricing(modelId?: string | null): ModelPricing {
  const family = getModelFamily(modelId);
  return CLAUDE_PRICING[family] || CLAUDE_PRICING['default'];
}

export interface CostCalculationParams {
  tokensInput?: number | null;
  tokensOutput?: number | null;
  tokensCacheCreation?: number | null;
  tokensCacheRead?: number | null;
  modelId?: string | null;
}

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
  totalCost: number;
  modelFamily: string;
  pricing: ModelPricing;
}

/**
 * Calculate cost from token usage
 * Returns total cost in USD
 */
export function calculateCost(params: CostCalculationParams): number {
  const pricing = getModelPricing(params.modelId);

  const inputCost = ((params.tokensInput || 0) * pricing.input) / 1_000_000;
  const outputCost = ((params.tokensOutput || 0) * pricing.output) / 1_000_000;
  const cacheWriteCost =
    ((params.tokensCacheCreation || 0) * pricing.cacheWrite) / 1_000_000;
  const cacheReadCost =
    ((params.tokensCacheRead || 0) * pricing.cacheRead) / 1_000_000;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

/**
 * Calculate cost with detailed breakdown
 * Useful for debugging and detailed cost analysis
 */
export function calculateCostWithBreakdown(
  params: CostCalculationParams,
): CostBreakdown {
  const modelFamily = getModelFamily(params.modelId);
  const pricing = getModelPricing(params.modelId);

  const inputCost = ((params.tokensInput || 0) * pricing.input) / 1_000_000;
  const outputCost = ((params.tokensOutput || 0) * pricing.output) / 1_000_000;
  const cacheWriteCost =
    ((params.tokensCacheCreation || 0) * pricing.cacheWrite) / 1_000_000;
  const cacheReadCost =
    ((params.tokensCacheRead || 0) * pricing.cacheRead) / 1_000_000;

  return {
    inputCost,
    outputCost,
    cacheWriteCost,
    cacheReadCost,
    totalCost: inputCost + outputCost + cacheWriteCost + cacheReadCost,
    modelFamily,
    pricing,
  };
}

/**
 * Format cost for display (e.g., "$0.0234")
 */
export function formatCost(cost: number, precision = 4): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.0001) return `$${cost.toExponential(2)}`;
  return `$${cost.toFixed(precision)}`;
}
