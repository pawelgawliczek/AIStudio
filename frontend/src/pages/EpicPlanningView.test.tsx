import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EpicPlanningView } from './EpicPlanningView';

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
        epics: [],
        unassignedStories: [],
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
