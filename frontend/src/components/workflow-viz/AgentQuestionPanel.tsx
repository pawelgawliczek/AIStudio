/**
 * AgentQuestionPanel Component
 * ST-168: Agent Q&A interface for human interaction
 */

import React, { useState } from 'react';
import { AgentQuestion } from './types';

export interface AgentQuestionPanelProps {
  question: AgentQuestion;
  stateName: string;
  agentName?: string;
  sessionId?: string;
  onSubmit: (answer: string) => void;
  onSkip: () => void;
  onHandoff: () => void;
}

export const AgentQuestionPanel: React.FC<AgentQuestionPanelProps> = ({
  question,
  stateName,
  agentName = 'Agent',
  sessionId,
  onSubmit,
  onSkip,
  onHandoff,
}) => {
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const waitingTime = question.askedAt
    ? Math.floor((Date.now() - new Date(question.askedAt).getTime()) / 60000)
    : 0;

  const handleSubmit = async () => {
    if (!answer.trim()) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(answer);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setIsSubmitting(true);
    try {
      await onSkip();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHandoff = async () => {
    setIsSubmitting(true);
    try {
      await onHandoff();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey && answer.trim()) {
      handleSubmit();
    }
  };

  // Answered state
  if (question.status === 'answered') {
    return (
      <div
        className="border border-gray-600 bg-gray-800/50 rounded-lg p-4 my-2"
        data-testid="question-answered"
        role="region"
        aria-label="Answered question"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-green-400">✓</span>
          <span className="text-sm text-gray-300">Question Answered</span>
        </div>
        <div className="text-sm text-gray-400 mb-2">
          <strong>Q:</strong> {question.question}
        </div>
        <div className="text-sm text-gray-200">
          <strong>A:</strong> {question.answer}
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Answered by {question.answeredBy || 'user'} •{' '}
          {question.answeredAt
            ? new Date(question.answeredAt).toLocaleTimeString()
            : 'recently'}
        </div>
      </div>
    );
  }

  // Skipped state
  if (question.status === 'skipped') {
    return (
      <div
        className="border border-gray-600 bg-gray-800/50 rounded-lg p-4 my-2 opacity-50"
        data-testid="question-skipped"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-gray-400">⏭</span>
          <span className="text-sm text-gray-400">Question Skipped</span>
        </div>
        <div className="text-sm text-gray-500">{question.question}</div>
      </div>
    );
  }

  // Pending state
  return (
    <div
      className="border-2 border-orange-500 bg-orange-500/10 rounded-lg p-4 my-4"
      data-testid="agent-question-panel"
      role="region"
      aria-label={`Question from ${agentName}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">❓</span>
          <div>
            <h3 className="font-semibold text-orange-200">Agent Question</h3>
            <p className="text-sm text-gray-400">
              {agentName} • State: {stateName} • Waiting: {waitingTime} min
            </p>
          </div>
        </div>
        <span
          className="px-2 py-1 text-xs rounded bg-orange-500/20 text-orange-400"
          data-testid="question-status"
        >
          WAITING
        </span>
      </div>

      {/* Question */}
      <div className="mb-4 p-3 bg-gray-800 rounded" data-testid="question-content">
        <p className="text-gray-200 whitespace-pre-wrap">{question.question}</p>
      </div>

      {/* Answer Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Your Answer
        </label>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your answer here... (Ctrl+Enter to submit)"
          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-gray-200 min-h-[100px]"
          data-testid="answer-textarea"
          disabled={isSubmitting}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !answer.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-2 disabled:opacity-50"
          data-testid="submit-button"
        >
          <span>📤</span>
          Submit Answer
        </button>

        <button
          onClick={handleSkip}
          disabled={isSubmitting}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded flex items-center gap-2 disabled:opacity-50"
          data-testid="skip-button"
        >
          <span>⏭</span>
          Skip Question
        </button>

        <button
          onClick={handleHandoff}
          disabled={isSubmitting}
          className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded flex items-center gap-2 disabled:opacity-50"
          data-testid="handoff-button"
          title={sessionId ? `Resume session: ${sessionId}` : 'Handoff to local CLI'}
        >
          <span>🖥</span>
          Handoff to Local CLI
        </button>
      </div>

      {/* Session Info */}
      {sessionId && (
        <div className="mt-3 text-xs text-gray-500">
          Session: <code className="text-gray-400">{sessionId}</code>
        </div>
      )}

      <div className="mt-3 text-xs text-orange-400">
        ⚠️ Agent is paused waiting for your response
      </div>
    </div>
  );
};

/**
 * PendingQuestionsBanner Component
 * Shows a banner when multiple questions are pending
 */
export interface PendingQuestionsBannerProps {
  questions: Array<{
    id: string;
    stateName: string;
    preview: string;
  }>;
  onViewAll: () => void;
  onAnswerQuestion: (questionId: string) => void;
}

export const PendingQuestionsBanner: React.FC<PendingQuestionsBannerProps> = ({
  questions,
  onViewAll,
  onAnswerQuestion,
}) => {
  if (questions.length === 0) return null;

  return (
    <div
      className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-4 mb-4"
      data-testid="pending-questions-banner"
      role="region"
      aria-label="Pending questions"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">❓</span>
          <span className="font-semibold text-orange-200">
            {questions.length} question{questions.length > 1 ? 's' : ''} waiting for answers
          </span>
        </div>
        <button
          onClick={onViewAll}
          className="text-sm text-orange-400 hover:text-orange-300"
          data-testid="view-all-questions"
        >
          View All →
        </button>
      </div>

      <div className="space-y-2">
        {questions.slice(0, 3).map((q, index) => (
          <div
            key={q.id}
            className="flex items-center justify-between p-2 bg-gray-800 rounded"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-gray-400">{index + 1}.</span>
              <span className="text-sm text-gray-300 truncate">{q.stateName}:</span>
              <span className="text-sm text-gray-400 truncate">"{q.preview}"</span>
            </div>
            <button
              onClick={() => onAnswerQuestion(q.id)}
              className="text-xs text-blue-400 hover:text-blue-300 ml-2"
              data-testid={`answer-question-${q.id}`}
            >
              Answer →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
