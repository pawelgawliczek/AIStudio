import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EpicPlanningView } from './EpicPlanningView';

// Mock the project context
vi.mock('../context/ProjectContext', () => ({
  useProject: () => ({
    selectedProject: { id: 'test-project-id', name: 'Test Project' },
    projects: [{ id: 'test-project-id', name: 'Test Project' }],
  }),
}));

// Mock the websocket service
vi.mock('../services/websocket.service', () => ({
  useWebSocket: () => ({
    isConnected: true,
    socket: null,
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
  }),
  useStoryEvents: vi.fn(),
  useEpicEvents: vi.fn(),
}));

// Mock the API services
vi.mock('../services/api', () => ({
  epicsApi: {
    getPlanningOverview: vi.fn().mockResolvedValue({
      data: {
        epics: [
          {
            id: 'epic-1',
            title: 'Epic 1',
            key: 'EP-1',
            status: 'in_progress',
            priority: 1,
            stories: [
              { id: 'story-1', title: 'Story 1', key: 'ST-1', status: 'done', type: 'feature', businessImpact: 5 },
              { id: 'story-2', title: 'Story 2', key: 'ST-2', status: 'planning', type: 'feature', businessImpact: 3 },
            ],
          },
          {
            id: 'epic-2',
            title: 'Epic 2',
            key: 'EP-2',
            status: 'planning',
            priority: 2,
            stories: [
              { id: 'story-3', title: 'Story 3', key: 'ST-3', status: 'done', type: 'bug', businessImpact: 7 },
              { id: 'story-4', title: 'Story 4', key: 'ST-4', status: 'done', type: 'feature', businessImpact: 4 },
            ],
          },
        ],
        unassignedStories: [
          { id: 'story-5', title: 'Unassigned Story', key: 'ST-5', status: 'done', type: 'chore', businessImpact: 2 },
        ],
      },
    }),
    updatePriority: vi.fn(),
  },
  storiesApi: {
    updatePriority: vi.fn(),
    reassignEpic: vi.fn(),
  },
}));

// Mock components to simplify testing
vi.mock('../components/planning/EpicGroup', () => ({
  EpicGroup: ({ epic, stories }: any) => (
    <div data-testid="epic-group">
      {epic ? epic.title : 'Unassigned'}
      {stories?.map((s: any) => <div key={s.id}>{s.title}</div>)}
    </div>
  ),
}));

vi.mock('../components/planning/PlanningFilters', () => ({
  PlanningFilters: () => <div data-testid="planning-filters">Filters</div>,
}));

vi.mock('../components/planning/PlanningItemCard', () => ({
  PlanningItemCard: ({ item }: any) => (
    <div data-testid="planning-item-card">{item.title}</div>
  ),
}));

vi.mock('../components/StoryDetailDrawer', () => ({
  StoryDetailDrawer: () => <div data-testid="story-detail-drawer">Drawer</div>,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </BrowserRouter>
  );
};

beforeEach(() => {
  // Clear sessionStorage before each test
  sessionStorage.clear();
});

describe('EpicPlanningView', () => {
  it('renders without crashing', () => {
    render(<EpicPlanningView />, { wrapper: createWrapper() });
    expect(screen.getByText('Epic Planning')).toBeInTheDocument();
  });

  it('displays grouped view toggle by default', () => {
    render(<EpicPlanningView />, { wrapper: createWrapper() });
    expect(screen.getByText('Grouped by Epics')).toBeInTheDocument();
    expect(screen.getByText('Flat View')).toBeInTheDocument();
  });

  it('displays sort dropdown', () => {
    render(<EpicPlanningView />, { wrapper: createWrapper() });
    const sortSelect = screen.getByRole('combobox');
    expect(sortSelect).toBeInTheDocument();
  });

  it('renders filters component', () => {
    render(<EpicPlanningView />, { wrapper: createWrapper() });
    expect(screen.getByTestId('planning-filters')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(<EpicPlanningView />, { wrapper: createWrapper() });
    expect(screen.getByText(/loading planning data/i)).toBeInTheDocument();
  });

  it('shows message when no project is selected', () => {
    // Remove projectId from URL
    window.history.pushState({}, '', '/epic-planning');
    render(<EpicPlanningView />, { wrapper: createWrapper() });
    expect(screen.getByText('No Project Selected')).toBeInTheDocument();
  });
});

describe('EpicPlanningView - Show/Hide Completed Items', () => {
  it('displays a global toggle button to show/hide completed items', async () => {
    render(<EpicPlanningView />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText(/loading planning data/i)).not.toBeInTheDocument();
    });

    // Should have a button to toggle completed items
    const toggleButton = screen.getByRole('button', { name: /hide completed/i });
    expect(toggleButton).toBeInTheDocument();
  });

  it('hides completed items by default', async () => {
    render(<EpicPlanningView />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText(/loading planning data/i)).not.toBeInTheDocument();
    });

    // Completed stories should be hidden by default
    // Epic 1 has 1 done story out of 2, Epic 2 has 2 done stories
    // We should only see the non-done stories
    expect(screen.queryByText('Story 1')).not.toBeInTheDocument(); // done
    expect(screen.getByText('Story 2')).toBeInTheDocument(); // not done
  });

  it('shows completed items when toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<EpicPlanningView />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText(/loading planning data/i)).not.toBeInTheDocument();
    });

    // Initially completed items are hidden
    expect(screen.queryByText('Story 1')).not.toBeInTheDocument();

    // Click the toggle button
    const toggleButton = screen.getByRole('button', { name: /hide completed/i });
    await user.click(toggleButton);

    // Now completed items should be visible
    await waitFor(() => {
      expect(screen.getByText('Story 1')).toBeInTheDocument();
    });

    // Button text should change
    expect(screen.getByRole('button', { name: /show completed/i })).toBeInTheDocument();
  });

  it('persists toggle state in sessionStorage', async () => {
    const user = userEvent.setup();
    render(<EpicPlanningView />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText(/loading planning data/i)).not.toBeInTheDocument();
    });

    // Click the toggle button to show completed items
    const toggleButton = screen.getByRole('button', { name: /hide completed/i });
    await user.click(toggleButton);

    // Check sessionStorage was updated
    expect(sessionStorage.getItem('hideCompletedItems')).toBe('false');
  });

  it('marks completed items with "Done" badge when visible', async () => {
    const user = userEvent.setup();
    render(<EpicPlanningView />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText(/loading planning data/i)).not.toBeInTheDocument();
    });

    // Show completed items
    const toggleButton = screen.getByRole('button', { name: /hide completed/i });
    await user.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByText('Story 1')).toBeInTheDocument();
    });

    // Completed stories should have a "Done" indicator
    // This will be tested in the EpicGroup component
  });

  it('restores toggle state from sessionStorage on mount', async () => {
    // Set sessionStorage to show completed items
    sessionStorage.setItem('hideCompletedItems', 'false');

    render(<EpicPlanningView />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText(/loading planning data/i)).not.toBeInTheDocument();
    });

    // Completed items should be visible
    expect(screen.getByText('Story 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show completed/i })).toBeInTheDocument();
  });
});
