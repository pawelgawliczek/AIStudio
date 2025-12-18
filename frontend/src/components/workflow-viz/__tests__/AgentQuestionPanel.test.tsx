/**
 * Unit tests for AgentQuestionPanel component
 * ST-168: Agent Q&A interface
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AgentQuestionPanel, PendingQuestionsBanner } from '../AgentQuestionPanel';
import { AgentQuestion } from '../types';

describe('AgentQuestionPanel', () => {
  const mockQuestion: AgentQuestion = {
    id: 'q-1',
    workflowRunId: 'run-123',
    stateId: 's1',
    question: 'Which authentication approach should I use?',
    answer: null,
    status: 'pending',
    askedAt: new Date(Date.now() - 2 * 60000).toISOString(), // 2 min ago
    answeredAt: null,
    answeredBy: null,
  };

  describe('TC-QUESTION-001: Pending question rendering', () => {
    it('should render pending question panel', () => {
      const onSubmit = vi.fn();
      const onSkip = vi.fn();
      const onHandoff = vi.fn();

      render(
        <AgentQuestionPanel
          question={mockQuestion}
          stateName="Architecture"
          onSubmit={onSubmit}
          onSkip={onSkip}
          onHandoff={onHandoff}
        />
      );

      expect(screen.getByTestId('agent-question-panel')).toBeInTheDocument();
      expect(screen.getByTestId('question-status')).toHaveTextContent('WAITING');
      expect(screen.getByText(/Which authentication approach/)).toBeInTheDocument();
    });

    it('should display agent name and state', () => {
      const onSubmit = vi.fn();
      const onSkip = vi.fn();
      const onHandoff = vi.fn();

      render(
        <AgentQuestionPanel
          question={mockQuestion}
          stateName="Architecture"
          agentName="Software Architect"
          onSubmit={onSubmit}
          onSkip={onSkip}
          onHandoff={onHandoff}
        />
      );

      expect(screen.getByText(/Software Architect/)).toBeInTheDocument();
      expect(screen.getByText(/Architecture/)).toBeInTheDocument();
    });

    it('should display session ID when provided', () => {
      const onSubmit = vi.fn();
      const onSkip = vi.fn();
      const onHandoff = vi.fn();

      render(
        <AgentQuestionPanel
          question={mockQuestion}
          stateName="Architecture"
          sessionId="abc123-def456"
          onSubmit={onSubmit}
          onSkip={onSkip}
          onHandoff={onHandoff}
        />
      );

      expect(screen.getByText('abc123-def456')).toBeInTheDocument();
    });
  });

  describe('TC-QUESTION-002: Submit answer', () => {
    it('should disable submit button when no answer entered', () => {
      const onSubmit = vi.fn();
      const onSkip = vi.fn();
      const onHandoff = vi.fn();

      render(
        <AgentQuestionPanel
          question={mockQuestion}
          stateName="Architecture"
          onSubmit={onSubmit}
          onSkip={onSkip}
          onHandoff={onHandoff}
        />
      );

      expect(screen.getByTestId('submit-button')).toBeDisabled();
    });

    it('should enable submit button when answer entered', () => {
      const onSubmit = vi.fn();
      const onSkip = vi.fn();
      const onHandoff = vi.fn();

      render(
        <AgentQuestionPanel
          question={mockQuestion}
          stateName="Architecture"
          onSubmit={onSubmit}
          onSkip={onSkip}
          onHandoff={onHandoff}
        />
      );

      fireEvent.change(screen.getByTestId('answer-textarea'), {
        target: { value: 'Use JWT-based approach' },
      });

      expect(screen.getByTestId('submit-button')).not.toBeDisabled();
    });

    it('should call onSubmit with answer', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onSkip = vi.fn();
      const onHandoff = vi.fn();

      render(
        <AgentQuestionPanel
          question={mockQuestion}
          stateName="Architecture"
          onSubmit={onSubmit}
          onSkip={onSkip}
          onHandoff={onHandoff}
        />
      );

      fireEvent.change(screen.getByTestId('answer-textarea'), {
        target: { value: 'Use JWT-based approach' },
      });
      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith('Use JWT-based approach');
      });
    });
  });

  describe('TC-QUESTION-003: Skip question', () => {
    it('should call onSkip when skip button clicked', async () => {
      const onSubmit = vi.fn();
      const onSkip = vi.fn().mockResolvedValue(undefined);
      const onHandoff = vi.fn();

      render(
        <AgentQuestionPanel
          question={mockQuestion}
          stateName="Architecture"
          onSubmit={onSubmit}
          onSkip={onSkip}
          onHandoff={onHandoff}
        />
      );

      fireEvent.click(screen.getByTestId('skip-button'));

      await waitFor(() => {
        expect(onSkip).toHaveBeenCalled();
      });
    });
  });

  describe('TC-QUESTION-004: Handoff to local CLI', () => {
    it('should call onHandoff when handoff button clicked', async () => {
      const onSubmit = vi.fn();
      const onSkip = vi.fn();
      const onHandoff = vi.fn().mockResolvedValue(undefined);

      render(
        <AgentQuestionPanel
          question={mockQuestion}
          stateName="Architecture"
          onSubmit={onSubmit}
          onSkip={onSkip}
          onHandoff={onHandoff}
        />
      );

      fireEvent.click(screen.getByTestId('handoff-button'));

      await waitFor(() => {
        expect(onHandoff).toHaveBeenCalled();
      });
    });
  });

  describe('TC-QUESTION-005: Answered question display', () => {
    it('should render answered question in collapsed state', () => {
      const answeredQuestion: AgentQuestion = {
        ...mockQuestion,
        status: 'answered',
        answer: 'Use JWT-based approach for API authentication.',
        answeredAt: new Date().toISOString(),
        answeredBy: 'pawel',
      };

      const onSubmit = vi.fn();
      const onSkip = vi.fn();
      const onHandoff = vi.fn();

      render(
        <AgentQuestionPanel
          question={answeredQuestion}
          stateName="Architecture"
          onSubmit={onSubmit}
          onSkip={onSkip}
          onHandoff={onHandoff}
        />
      );

      expect(screen.getByTestId('question-answered')).toBeInTheDocument();
      expect(screen.getByText(/Use JWT-based approach/)).toBeInTheDocument();
      expect(screen.getByText(/pawel/)).toBeInTheDocument();
    });
  });

  describe('TC-QUESTION-006: Skipped question display', () => {
    it('should render skipped question with muted styling', () => {
      const skippedQuestion: AgentQuestion = {
        ...mockQuestion,
        status: 'skipped',
      };

      const onSubmit = vi.fn();
      const onSkip = vi.fn();
      const onHandoff = vi.fn();

      render(
        <AgentQuestionPanel
          question={skippedQuestion}
          stateName="Architecture"
          onSubmit={onSubmit}
          onSkip={onSkip}
          onHandoff={onHandoff}
        />
      );

      expect(screen.getByTestId('question-skipped')).toBeInTheDocument();
    });
  });
});

describe('PendingQuestionsBanner', () => {
  const mockQuestions = [
    { id: 'q1', stateName: 'Architecture', preview: 'Which auth approach?' },
    { id: 'q2', stateName: 'Implementation', preview: 'Create new file?' },
    { id: 'q3', stateName: 'Review', preview: 'Include E2E tests?' },
  ];

  describe('TC-BANNER-001: Banner rendering', () => {
    it('should render banner with question count', () => {
      const onViewAll = vi.fn();
      const onAnswerQuestion = vi.fn();

      render(
        <PendingQuestionsBanner
          questions={mockQuestions}
          onViewAll={onViewAll}
          onAnswerQuestion={onAnswerQuestion}
        />
      );

      expect(screen.getByTestId('pending-questions-banner')).toBeInTheDocument();
      expect(screen.getByText(/3 questions/)).toBeInTheDocument();
    });

    it('should not render when no questions', () => {
      const onViewAll = vi.fn();
      const onAnswerQuestion = vi.fn();

      const { container } = render(
        <PendingQuestionsBanner
          questions={[]}
          onViewAll={onViewAll}
          onAnswerQuestion={onAnswerQuestion}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should display question previews', () => {
      const onViewAll = vi.fn();
      const onAnswerQuestion = vi.fn();

      render(
        <PendingQuestionsBanner
          questions={mockQuestions}
          onViewAll={onViewAll}
          onAnswerQuestion={onAnswerQuestion}
        />
      );

      expect(screen.getByText(/Which auth approach/)).toBeInTheDocument();
      expect(screen.getByText(/Create new file/)).toBeInTheDocument();
      expect(screen.getByText(/Include E2E tests/)).toBeInTheDocument();
    });
  });

  describe('TC-BANNER-002: Interactions', () => {
    it('should call onViewAll when View All clicked', () => {
      const onViewAll = vi.fn();
      const onAnswerQuestion = vi.fn();

      render(
        <PendingQuestionsBanner
          questions={mockQuestions}
          onViewAll={onViewAll}
          onAnswerQuestion={onAnswerQuestion}
        />
      );

      fireEvent.click(screen.getByTestId('view-all-questions'));

      expect(onViewAll).toHaveBeenCalled();
    });

    it('should call onAnswerQuestion when Answer clicked', () => {
      const onViewAll = vi.fn();
      const onAnswerQuestion = vi.fn();

      render(
        <PendingQuestionsBanner
          questions={mockQuestions}
          onViewAll={onViewAll}
          onAnswerQuestion={onAnswerQuestion}
        />
      );

      fireEvent.click(screen.getByTestId('answer-question-q1'));

      expect(onAnswerQuestion).toHaveBeenCalledWith('q1');
    });
  });
});
