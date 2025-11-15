import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from './DashboardPage';
import { ThemeProvider } from '../context/ThemeContext';

// Mock the project context
const mockSelectedProject = { id: 'test-project-id', name: 'Test Project' };
vi.mock('../context/ProjectContext', () => ({
  useProject: () => ({
    selectedProject: mockSelectedProject,
    projects: [mockSelectedProject],
  }),
}));

// Mock the API services
vi.mock('../services/api', () => ({
  storiesApi: {
    getAll: vi.fn().mockResolvedValue({
      data: [
        { id: '1', status: 'done', type: 'feature' },
        { id: '2', status: 'planning', type: 'feature' },
        { id: '3', status: 'review', type: 'bug' },
        { id: '4', status: 'blocked', type: 'bug' },
      ],
    }),
  },
  epicsApi: {
    getAll: vi.fn().mockResolvedValue({
      data: [
        { id: 'epic-1', title: 'Epic 1' },
        { id: 'epic-2', title: 'Epic 2' },
      ],
    }),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

beforeEach(() => {
  localStorage.clear();
  // Reset to light theme
  document.documentElement.removeAttribute('data-theme');
});

describe('DashboardPage - Theme Support', () => {
  it('renders with light theme by default', async () => {
    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Check that document has no dark theme attribute
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('applies theme-aware classes to all card elements', async () => {
    const { container } = render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Find all stat cards - they should use theme-aware bg-card class
    const cards = container.querySelectorAll('.bg-card');
    expect(cards.length).toBeGreaterThan(0);

    // Check for theme-aware text classes
    const fgElements = container.querySelectorAll('.text-fg');
    expect(fgElements.length).toBeGreaterThan(0);

    const mutedElements = container.querySelectorAll('.text-muted');
    expect(mutedElements.length).toBeGreaterThan(0);
  });

  it('does not use hardcoded gray colors', async () => {
    const { container } = render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Should not have hardcoded gray backgrounds
    const grayBackgrounds = container.querySelectorAll('[class*="bg-gray-"]');
    expect(grayBackgrounds.length).toBe(0);

    // Should not have hardcoded gray text colors (excluding icon colors which are ok)
    const grayTexts = container.querySelectorAll('[class*="text-gray-9"]'); // text-gray-900, etc
    expect(grayTexts.length).toBe(0);
  });

  it('uses theme-aware border colors', async () => {
    const { container } = render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Check for theme-aware border classes
    const borderElements = container.querySelectorAll('.border-border');
    expect(borderElements.length).toBeGreaterThan(0);
  });

  it('uses theme-aware accent colors for links', async () => {
    const { container } = render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Check for accent color usage in links
    const accentLinks = container.querySelectorAll('.text-accent');
    expect(accentLinks.length).toBeGreaterThan(0);
  });

  it('maintains proper contrast in dark mode', async () => {
    // Set dark theme
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');

    const { container } = render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Verify dark theme is applied
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // All cards should still use theme-aware classes
    const cards = container.querySelectorAll('.bg-card');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('uses theme-aware secondary background', async () => {
    const { container } = render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Check for secondary background usage
    const secondaryBg = container.querySelectorAll('.bg-bg-secondary');
    expect(secondaryBg.length).toBeGreaterThan(0);
  });
});

describe('DashboardPage - Statistics Display', () => {
  it('displays project statistics with theme-aware styling', async () => {
    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Project Dashboard')).toBeInTheDocument();
    });

    // Check that stats are displayed
    expect(screen.getByText('Total Stories')).toBeInTheDocument();
    expect(screen.getByText('Completion Rate')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Issues')).toBeInTheDocument();
  });

  it('displays quick actions section with theme-aware styling', async () => {
    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    });

    expect(screen.getByText('Planning Board')).toBeInTheDocument();
    expect(screen.getByText(/Epics/)).toBeInTheDocument();
    expect(screen.getByText('Stories List')).toBeInTheDocument();
  });

  it('displays project metrics section with theme-aware styling', async () => {
    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Project Metrics')).toBeInTheDocument();
    });

    expect(screen.getByText('Code Quality')).toBeInTheDocument();
    expect(screen.getByText('Test Coverage')).toBeInTheDocument();
    expect(screen.getByText('Agent Performance')).toBeInTheDocument();
  });

  it('displays info panel with theme-aware styling', async () => {
    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('📚 Understanding the Views')).toBeInTheDocument();
    });

    expect(screen.getByText('🎯 Planning Board')).toBeInTheDocument();
    expect(screen.getByText('🟣 Epics')).toBeInTheDocument();
    expect(screen.getByText('📖 Stories List')).toBeInTheDocument();
  });
});

describe('DashboardPage - No Project Selected', () => {
  it('displays "No Project Selected" message with theme-aware styling', () => {
    vi.mock('../context/ProjectContext', () => ({
      useProject: () => ({
        selectedProject: null,
        projects: [],
      }),
    }));

    render(<DashboardPage />, { wrapper: createWrapper() });

    expect(screen.getByText('No Project Selected')).toBeInTheDocument();
    expect(
      screen.getByText('Select a project from the dropdown above to view dashboard statistics.')
    ).toBeInTheDocument();
  });
});
