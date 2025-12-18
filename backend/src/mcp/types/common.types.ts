/**
 * Common MCP Type Definitions
 * Shared types used across all MCP tools
 */

export interface ToolMetadata {
  category: string;
  domain?: string;
  version?: string;
  since?: string;
  lastUpdated?: string;
  tags?: string[];
  aiHints?: string[];
  dependencies?: string[];
}

export interface PaginationParams {
  page?: number; // Default: 1
  pageSize?: number; // Default: 20, Max: 100
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
