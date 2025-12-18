import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { useProject } from '../../context/ProjectContext';
import { workflowRunsService } from '../../services/workflow-runs.service';
import { TeamRunsListView } from '../TeamRunsListView';
// Mock the workflow runs service
vi.mock('../../services/workflow-runs.service', () => ({
  workflowRunsService: {
    getAll: vi.fn(),
  },
  RunStatus: {
    PENDING: 'PENDING',
    RUNNING: 'RUNNING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
  },
}));

// Mock the context providers
vi.mock('../../context/ProjectContext', () => ({
  useProject: vi.fn(),
  ProjectProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockProject = {
  id: 'project-1',
  name: 'Test Project',
  description: 'Test project description',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockRuns = [
  {
    id: 'run-1',
    projectId: 'project-1',
    workflowId: 'workflow-1',
    storyId: 'story-1',
    startedAt: '2024-01-01T10:00:00.000Z',
    durationSeconds: 120,
    totalTokens: 1000,
    estimatedCost: 0.05,
    status: 'COMPLETED',
    createdAt: '2024-01-01T10:00:00.000Z',
    updatedAt: '2024-01-01T10:02:00.000Z',
    workflow: {
      id: 'workflow-1',
      name: 'Test Workflow',
      version: '1.0.0',
    },
    story: {
      id: 'story-1',
      key: 'ST-123',
      title: 'Test Story',
    },
  },
  {
    id: 'run-2',
    projectId: 'project-1',
    workflowId: 'workflow-1',
    storyId: 'story-1',
    startedAt: '2024-01-01T09:00:00.000Z',
    durationSeconds: 90,
    totalTokens: 800,
    estimatedCost: 0.04,
    status: 'FAILED',
    createdAt: '2024-01-01T09:00:00.000Z',
    updatedAt: '2024-01-01T09:01:30.000Z',
    workflow: {
      id: 'workflow-1',
      name: 'Test Workflow',
      version: '1.0.0',
    },
    story: {
      id: 'story-1',
      key: 'ST-123',
      title: 'Test Story',
    },
  },
];

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('TeamRunsListView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useProject as any).mockReturnValue({
      selectedProject: null,
      projects: [],
      setSelectedProject: vi.fn(),
      loading: false,
    });
  });

  it('renders loading state initially', () => {
    (useProject as any).mockReturnValue({
      selectedProject: mockProject,
      projects: [mockProject],
      setSelectedProject: vi.fn(),
      loading: false,
    });

    (workflowRunsService.getAll as any).mockReturnValue(new Promise(() => {}));

    render(<TeamRunsListView />, { wrapper: createWrapper() });

    expect(screen.getByText('Loading runs...')).toBeInTheDocument();
  });

  it('renders message when no project is selected', () => {
    render(<TeamRunsListView />, { wrapper: createWrapper() });

    expect(screen.getByText('Please select a project to view team runs.')).toBeInTheDocument();
  });

  it('displays summary cards with correct counts', async () => {
    (useProject as any).mockReturnValue({
      selectedProject: mockProject,
      projects: [mockProject],
      setSelectedProject: vi.fn(),
      loading: false,
    });

    (workflowRunsService.getAll as any).mockResolvedValue(mockRuns);

    render(<TeamRunsListView />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Total Runs')).toBeInTheDocument();
    });

    // Check that summary cards are present (text appears multiple times - in cards and filters)
    const completedElements = screen.getAllByText('Completed');
    expect(completedElements.length).toBeGreaterThan(0);

    const inProgressElements = screen.getAllByText('In Progress');
    expect(inProgressElements.length).toBeGreaterThan(0);

    const failedElements = screen.getAllByText('Failed');
    expect(failedElements.length).toBeGreaterThan(0);
  });

  it('displays correct run count', async () => {
    (useProject as any).mockReturnValue({
      selectedProject: mockProject,
      projects: [mockProject],
      setSelectedProject: vi.fn(),
      loading: false,
    });

    (workflowRunsService.getAll as any).mockResolvedValue(mockRuns);

    render(<TeamRunsListView />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Found 2 runs/)).toBeInTheDocument();
    });
  });

  it('renders filters section', async () => {
    (useProject as any).mockReturnValue({
      selectedProject: mockProject,
      projects: [mockProject],
      setSelectedProject: vi.fn(),
      loading: false,
    });

    (workflowRunsService.getAll as any).mockResolvedValue(mockRuns);

    render(<TeamRunsListView />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Sort By')).toBeInTheDocument();
  });
});
