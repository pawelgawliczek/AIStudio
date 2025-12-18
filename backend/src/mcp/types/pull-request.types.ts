/**
 * Pull Request Management Type Definitions
 */

export interface CreatePullRequestParams {
  storyId: string;
  title?: string;
  description?: string;
  draft?: boolean;
  baseBranch?: string;
}

export interface CreatePullRequestResponse {
  success: true;
  prId: string;
  prNumber: number;
  prUrl: string;
  status: string;
  message: string;
}

export interface GetPrStatusParams {
  storyId?: string;
  prNumber?: number;
  prUrl?: string;
  includeComments?: boolean;
  includeReviews?: boolean;
}

export interface ReviewInfo {
  reviewer: string;
  status: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED';
  submittedAt: string;
}

export interface CheckInfo {
  name: string;
  status: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'SKIPPED';
  conclusion: string;
}

export interface GetPrStatusResponse {
  success: true;
  prNumber: number;
  prUrl: string;
  status: string;
  title: string;
  state: string;
  checksStatus: 'PASSING' | 'FAILING' | 'PENDING' | 'NONE';
  approvals: ReviewInfo[];
  ciChecks: CheckInfo[];
  mergeable: boolean;
  conflictStatus: 'NONE' | 'CONFLICTING' | 'UNKNOWN';
  commentCount?: number;
}

export interface MergePullRequestParams {
  storyId?: string;
  prNumber?: number;
  mergeMethod?: 'merge' | 'squash' | 'rebase';
  deleteBranch?: boolean;
  requireApproval?: boolean;
  requireChecks?: boolean;
}

export interface MergePullRequestResponse {
  success: true;
  prNumber: number;
  prUrl: string;
  mergeCommitSha: string;
  mergedAt: string;
  branchDeleted: boolean;
  message: string;
}

export interface ClosePullRequestParams {
  storyId?: string;
  prNumber?: number;
  reason?: string;
  comment?: string;
  deleteBranch?: boolean;
}

export interface ClosePullRequestResponse {
  success: true;
  prNumber: number;
  prUrl: string;
  closedAt: string;
  reason?: string;
  branchDeleted: boolean;
  message: string;
}

export interface PullRequestErrorResponse {
  success: false;
  error: 'ValidationError' | 'NotFoundError' | 'MCPError';
  message: string;
  details?: Record<string, any>;
  suggestion: string;
  retryable: boolean;
  errorCode: string;
}
