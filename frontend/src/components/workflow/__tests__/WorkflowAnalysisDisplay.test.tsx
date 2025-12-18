import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Story, StoryStatus, StoryType } from '../../../types';
import { WorkflowAnalysisDisplay } from '../WorkflowAnalysisDisplay';

// Mock AnalysisSection to simplify testing
vi.mock('../AnalysisSection', () => ({
  AnalysisSection: ({ title, content, icon, timestamp }: any) => (
    <div data-testid={`analysis-section-${title.toLowerCase().replace(/[\s/]/g, '-')}`}>
      <div data-testid="section-title">{title}</div>
      {icon && <div data-testid="section-icon">Icon</div>}
      {content && <div data-testid="section-content">{content}</div>}
      {timestamp && <div data-testid="section-timestamp">{timestamp}</div>}
    </div>
  ),
}));

const createMockStory = (overrides?: Partial<Story>): Story => ({
  id: 'story-1',
  key: 'ST-13',
  projectId: 'proj-1',
  title: 'Test Story',
  status: StoryStatus.IMPLEMENTATION,
  type: StoryType.FEATURE,
  createdById: 'user-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('WorkflowAnalysisDisplay', () => {
  describe('TC-UI-013-004: Renders all four analysis sections', () => {
    it('renders all four sections with analysis data', () => {
      const story = createMockStory({
        contextExploration: 'Context exploration content',
        baAnalysis: 'Business analysis content',
        designerAnalysis: 'UI/UX design content',
        architectAnalysis: 'Architecture design content',
      });

      render(<WorkflowAnalysisDisplay story={story} />);

      expect(screen.getByTestId('analysis-section-context-exploration')).toBeInTheDocument();
      expect(screen.getByTestId('analysis-section-business-analysis')).toBeInTheDocument();
      expect(screen.getByTestId('analysis-section-ui-ux-design')).toBeInTheDocument();
      expect(screen.getByTestId('analysis-section-architecture-design')).toBeInTheDocument();
    });

    it('displays correct section titles', () => {
      const story = createMockStory({
        contextExploration: 'Content',
      });

      render(<WorkflowAnalysisDisplay story={story} />);

      const titles = screen.getAllByTestId('section-title');
      expect(titles).toHaveLength(4);
      expect(titles[0]).toHaveTextContent('Context Exploration');
      expect(titles[1]).toHaveTextContent('Business Analysis');
      expect(titles[2]).toHaveTextContent('UI/UX Design');
      expect(titles[3]).toHaveTextContent('Architecture Design');
    });

    it('displays section icons', () => {
      const story = createMockStory({
        contextExploration: 'Content',
      });

      render(<WorkflowAnalysisDisplay story={story} />);

      const icons = screen.getAllByTestId('section-icon');
      expect(icons).toHaveLength(4);
    });

    it('passes correct content to each section', () => {
      const story = createMockStory({
        contextExploration: 'Context content',
        baAnalysis: 'BA content',
        designerAnalysis: 'Design content',
        architectAnalysis: 'Architect content',
      });

      render(<WorkflowAnalysisDisplay story={story} />);

      expect(screen.getByText('Context content')).toBeInTheDocument();
      expect(screen.getByText('BA content')).toBeInTheDocument();
      expect(screen.getByText('Design content')).toBeInTheDocument();
      expect(screen.getByText('Architect content')).toBeInTheDocument();
    });

    it('passes correct timestamps to each section', () => {
      const story = createMockStory({
        contextExploration: 'Content',
        contextExploredAt: '2024-01-15T10:00:00Z',
        baAnalysis: 'Content',
        baAnalyzedAt: '2024-01-15T11:00:00Z',
        designerAnalysis: 'Content',
        designerAnalyzedAt: '2024-01-15T12:00:00Z',
        architectAnalysis: 'Content',
        architectAnalyzedAt: '2024-01-15T13:00:00Z',
      });

      render(<WorkflowAnalysisDisplay story={story} />);

      const timestamps = screen.getAllByTestId('section-timestamp');
      expect(timestamps).toHaveLength(4);
      expect(timestamps[0]).toHaveTextContent('2024-01-15T10:00:00Z');
      expect(timestamps[1]).toHaveTextContent('2024-01-15T11:00:00Z');
      expect(timestamps[2]).toHaveTextContent('2024-01-15T12:00:00Z');
      expect(timestamps[3]).toHaveTextContent('2024-01-15T13:00:00Z');
    });
  });

  describe('Conditional rendering', () => {
    it('returns null when no analysis data exists', () => {
      const story = createMockStory({
        contextExploration: null,
        baAnalysis: null,
        designerAnalysis: null,
        architectAnalysis: null,
      });

      const { container } = render(<WorkflowAnalysisDisplay story={story} />);

      expect(container.firstChild).toBeNull();
    });

    it('renders when only contextExploration exists', () => {
      const story = createMockStory({
        contextExploration: 'Context content',
      });

      render(<WorkflowAnalysisDisplay story={story} />);

      expect(screen.getByText('Workflow Analysis')).toBeInTheDocument();
      expect(screen.getByText('Context content')).toBeInTheDocument();
    });

    it('renders when only baAnalysis exists', () => {
      const story = createMockStory({
        baAnalysis: 'BA content',
      });

      render(<WorkflowAnalysisDisplay story={story} />);

      expect(screen.getByText('Workflow Analysis')).toBeInTheDocument();
      expect(screen.getByText('BA content')).toBeInTheDocument();
    });

    it('renders when only designerAnalysis exists', () => {
      const story = createMockStory({
        designerAnalysis: 'Design content',
      });

      render(<WorkflowAnalysisDisplay story={story} />);

      expect(screen.getByText('Workflow Analysis')).toBeInTheDocument();
      expect(screen.getByText('Design content')).toBeInTheDocument();
    });

    it('renders when only architectAnalysis exists', () => {
      const story = createMockStory({
        architectAnalysis: 'Architect content',
      });

      render(<WorkflowAnalysisDisplay story={story} />);

      expect(screen.getByText('Workflow Analysis')).toBeInTheDocument();
      expect(screen.getByText('Architect content')).toBeInTheDocument();
    });

    it('renders with partial analysis data', () => {
      const story = createMockStory({
        contextExploration: 'Context content',
        architectAnalysis: 'Architect content',
        // baAnalysis and designerAnalysis are null
      });

      render(<WorkflowAnalysisDisplay story={story} />);

      expect(screen.getByText('Workflow Analysis')).toBeInTheDocument();
      expect(screen.getByText('Context content')).toBeInTheDocument();
      expect(screen.getByText('Architect content')).toBeInTheDocument();
    });
  });

  describe('Component structure and styling', () => {
    it('renders with correct heading', () => {
      const story = createMockStory({
        contextExploration: 'Content',
      });

      render(<WorkflowAnalysisDisplay story={story} />);

      const heading = screen.getByText('Workflow Analysis');
      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe('H2');
    });

    it('renders sections in correct order', () => {
      const story = createMockStory({
        contextExploration: 'Content',
        baAnalysis: 'Content',
        designerAnalysis: 'Content',
        architectAnalysis: 'Content',
      });

      render(<WorkflowAnalysisDisplay story={story} />);

      const sections = screen.getAllByTestId(/analysis-section/);
      expect(sections[0]).toHaveAttribute('data-testid', 'analysis-section-context-exploration');
      expect(sections[1]).toHaveAttribute('data-testid', 'analysis-section-business-analysis');
      expect(sections[2]).toHaveAttribute('data-testid', 'analysis-section-ui-ux-design');
      expect(sections[3]).toHaveAttribute('data-testid', 'analysis-section-architecture-design');
    });

    it('applies spacing between sections', () => {
      const story = createMockStory({
        contextExploration: 'Content',
      });

      const { container } = render(<WorkflowAnalysisDisplay story={story} />);

      const sectionsContainer = container.querySelector('.space-y-3');
      expect(sectionsContainer).toBeInTheDocument();
    });

    it('renders with card styling', () => {
      const story = createMockStory({
        contextExploration: 'Content',
      });

      const { container } = render(<WorkflowAnalysisDisplay story={story} />);

      const card = container.querySelector('.bg-card.border.border-border.rounded-lg.shadow-md');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Props handling', () => {
    it('handles compact prop for drawer view', () => {
      const story = createMockStory({
        contextExploration: 'Content',
      });

      // Compact mode (for drawer)
      render(<WorkflowAnalysisDisplay story={story} compact={true} />);
      expect(screen.getByText('Workflow Analysis')).toBeInTheDocument();

      // Full mode (for page)
      render(<WorkflowAnalysisDisplay story={story} compact={false} />);
      expect(screen.getAllByText('Workflow Analysis')).toHaveLength(2);
    });

    it('handles null timestamps gracefully', () => {
      const story = createMockStory({
        contextExploration: 'Content',
        contextExploredAt: null,
      });

      render(<WorkflowAnalysisDisplay story={story} />);

      // Should render without timestamps
      expect(screen.queryByTestId('section-timestamp')).not.toBeInTheDocument();
    });

    it('handles undefined analysis fields', () => {
      const story = createMockStory({
        contextExploration: undefined,
        baAnalysis: undefined,
        designerAnalysis: undefined,
        architectAnalysis: undefined,
      });

      const { container } = render(<WorkflowAnalysisDisplay story={story} />);

      // Should not render anything
      expect(container.firstChild).toBeNull();
    });

    it('handles empty string analysis fields as no data', () => {
      const story = createMockStory({
        contextExploration: '',
        baAnalysis: '',
        designerAnalysis: '',
        architectAnalysis: '',
      });

      const { container } = render(<WorkflowAnalysisDisplay story={story} />);

      // Should not render because empty strings are falsy
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Icon mappings', () => {
    it('uses MagnifyingGlassIcon for Context Exploration', () => {
      const story = createMockStory({
        contextExploration: 'Content',
      });

      render(<WorkflowAnalysisDisplay story={story} />);

      // Icon should be present in first section
      const firstSection = screen.getByTestId('analysis-section-context-exploration');
      expect(firstSection.querySelector('[data-testid="section-icon"]')).toBeInTheDocument();
    });

    it('uses DocumentTextIcon for Business Analysis', () => {
      const story = createMockStory({
        baAnalysis: 'Content',
      });

      render(<WorkflowAnalysisDisplay story={story} />);

      // Icon should be present in second section
      const section = screen.getByTestId('analysis-section-business-analysis');
      expect(section.querySelector('[data-testid="section-icon"]')).toBeInTheDocument();
    });

    it('uses PaintBrushIcon for UI/UX Design', () => {
      const story = createMockStory({
        designerAnalysis: 'Content',
      });

      render(<WorkflowAnalysisDisplay story={story} />);

      // Icon should be present in third section
      const section = screen.getByTestId('analysis-section-ui-ux-design');
      expect(section.querySelector('[data-testid="section-icon"]')).toBeInTheDocument();
    });

    it('uses CubeIcon for Architecture Design', () => {
      const story = createMockStory({
        architectAnalysis: 'Content',
      });

      render(<WorkflowAnalysisDisplay story={story} />);

      // Icon should be present in fourth section
      const section = screen.getByTestId('analysis-section-architecture-design');
      expect(section.querySelector('[data-testid="section-icon"]')).toBeInTheDocument();
    });
  });
});
