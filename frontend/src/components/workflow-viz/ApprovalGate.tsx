/**
 * ApprovalGate Component
 * ST-168: Human-in-the-loop approval UI
 */

import React, { useState } from 'react';
import { ApprovalRequest } from './types';

export interface ApprovalGateProps {
  approval: ApprovalRequest;
  stateName: string;
  artifacts?: ArtifactSummary[];
  contextSummary?: string;
  onApprove: () => void;
  onRerun: (feedback: string) => void;
  onReject: (reason: string, mode: 'cancel' | 'pause') => void;
}

export interface ArtifactSummary {
  id: string;
  key: string;
  name: string;
  type: string;
}

export const ApprovalGate: React.FC<ApprovalGateProps> = ({
  approval,
  stateName,
  artifacts = [],
  contextSummary,
  onApprove,
  onRerun,
  onReject,
}) => {
  const [feedback, setFeedback] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectOptions, setShowRejectOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const waitingTime = approval.requestedAt
    ? Math.floor((Date.now() - new Date(approval.requestedAt).getTime()) / 60000)
    : 0;

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await onApprove();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRerun = async () => {
    if (!feedback.trim()) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onRerun(feedback);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (mode: 'cancel' | 'pause') => {
    setIsSubmitting(true);
    try {
      await onReject(rejectReason, mode);
    } finally {
      setIsSubmitting(false);
      setShowRejectOptions(false);
    }
  };

  return (
    <div
      className="border-2 border-purple-500 bg-purple-500/10 rounded-lg p-4 my-4"
      data-testid="approval-gate"
      role="region"
      aria-label={`Approval request for ${stateName}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">👤</span>
          <div>
            <h3 className="font-semibold text-purple-200">Awaiting Approval</h3>
            <p className="text-sm text-gray-400">
              State: {stateName} • Waiting: {waitingTime} min
            </p>
          </div>
        </div>
        <span
          className="px-2 py-1 text-xs rounded bg-yellow-500/20 text-yellow-400"
          data-testid="approval-status"
        >
          PENDING
        </span>
      </div>

      {/* Context Summary */}
      {contextSummary && (
        <div className="mb-4 p-3 bg-gray-800 rounded" data-testid="context-summary">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Context Summary</h4>
          <p className="text-sm text-gray-400 whitespace-pre-wrap">{contextSummary}</p>
        </div>
      )}

      {/* Artifacts to Review */}
      {artifacts.length > 0 && (
        <div className="mb-4" data-testid="artifacts-section">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Artifacts to Review</h4>
          <div className="space-y-1">
            {artifacts.map((artifact) => (
              <div
                key={artifact.id}
                className="flex items-center justify-between p-2 bg-gray-800 rounded"
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">📄</span>
                  <span className="text-sm text-gray-200">{artifact.name}</span>
                  <span className="text-xs text-gray-500">({artifact.key})</span>
                </div>
                <button
                  className="text-xs text-blue-400 hover:text-blue-300"
                  aria-label={`Open ${artifact.name}`}
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback for Rerun */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Feedback for Rerun (optional)
        </label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Enter feedback for the agent to address..."
          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-gray-200 text-sm min-h-[80px]"
          data-testid="feedback-textarea"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleApprove}
          disabled={isSubmitting}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-2 disabled:opacity-50"
          data-testid="approve-button"
        >
          <span>✓</span>
          Approve
        </button>

        <button
          onClick={handleRerun}
          disabled={isSubmitting || !feedback.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-2 disabled:opacity-50"
          data-testid="rerun-button"
        >
          <span>🔄</span>
          Rerun with Feedback
        </button>

        <button
          onClick={() => setShowRejectOptions(!showRejectOptions)}
          disabled={isSubmitting}
          className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded flex items-center gap-2 disabled:opacity-50"
          data-testid="reject-toggle"
        >
          <span>✗</span>
          Reject
        </button>
      </div>

      {/* Reject Options Panel */}
      {showRejectOptions && (
        <div
          className="mt-4 p-4 bg-gray-800 rounded border border-red-500/30"
          data-testid="reject-options"
        >
          <h4 className="text-sm font-medium text-red-400 mb-3">Reject Options</h4>

          <div className="mb-3">
            <label className="block text-sm text-gray-400 mb-1">
              Reason (optional)
            </label>
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why are you rejecting?"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-200 text-sm"
              data-testid="reject-reason"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleReject('cancel')}
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded disabled:opacity-50"
              data-testid="reject-cancel"
            >
              Cancel Workflow
            </button>
            <button
              onClick={() => handleReject('pause')}
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded disabled:opacity-50"
              data-testid="reject-pause"
            >
              Pause for Manual Fix
            </button>
            <button
              onClick={() => setShowRejectOptions(false)}
              className="px-3 py-1.5 text-gray-400 hover:text-gray-200 text-sm"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
