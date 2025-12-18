/**
 * TDD Tests for TaxonomyManager Integration into ProjectModal
 *
 * Tests the integration of TaxonomyManager component into ProjectModal with tabs.
 *
 * Test Coverage:
 * 1. Tab Visibility - Show tabs when editing, hide when creating
 * 2. Tab Switching - Default tab, switch between General and Taxonomy tabs
 * 3. Integration - TaxonomyManager renders with correct projectId
 * 4. Form Functionality - General Settings form still works with tabs present
 *
 * These tests are written BEFORE implementation (TDD red phase).
 * They will pass AFTER the tabs are added to ProjectModal.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { projectsService } from '../../services/projects.service';
import { taxonomyService } from '../../services/taxonomy.service';
import type { Project } from '../../types';
import { ProjectsPage } from '../ProjectsPage';

// Mock services
vi.mock('../../services/projects.service');
vi.mock('../../services/taxonomy.service');

// Mock TaxonomyManager component to avoid complex setup
vi.mock('../../components/project/TaxonomyManager', () => ({
  TaxonomyManager: ({ projectId }: { projectId: string }) => (
    <div data-testid="taxonomy-manager" data-project-id={projectId}>
      Taxonomy Manager for Project {projectId}
    </div>
  ),
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

const mockProjects: Project[] = [
  {
    id: 'project-1',
    name: 'Test Project',
    description: 'Test project description',
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
    _count: {
      epics: 5,
      stories: 10,
    },
  },
  {
    id: 'project-2',
    name: 'Another Project',
    description: 'Another description',
    createdAt: new Date('2024-01-02').toISOString(),
    updatedAt: new Date('2024-01-02').toISOString(),
    _count: {
      epics: 3,
      stories: 7,
    },
  },
];

describe('ProjectModal - TaxonomyManager Integration', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    user = userEvent.setup();

    // Reset mocks
    vi.clearAllMocks();

    // Setup service mocks
    vi.mocked(projectsService.getAll).mockResolvedValue(mockProjects);
    vi.mocked(projectsService.create).mockResolvedValue(mockProjects[0]);
    vi.mocked(projectsService.update).mockResolvedValue(mockProjects[0]);
    vi.mocked(taxonomyService.listAreas).mockResolvedValue([]);
  });

  const renderProjectsPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ProjectsPage />
      </QueryClientProvider>
    );
  };

  // ============================================================================
  // TAB VISIBILITY TESTS
  // ============================================================================

  describe('Tab Visibility', () => {
    it('should NOT show tabs when creating new project', async () => {
      renderProjectsPage();

      // Wait for projects to load
      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });

      // Click "New Project" button
      const newProjectButton = screen.getByRole('button', { name: /new project/i });
      await user.click(newProjectButton);

      // Modal should open
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Create New Project')).toBeInTheDocument();
      });

      // Should NOT show tabs (no tab elements)
      expect(screen.queryByRole('tab', { name: /general settings/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /taxonomy settings/i })).not.toBeInTheDocument();

      // Should show form fields directly (no tabs)
      expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it('should show tabs when editing existing project', async () => {
      renderProjectsPage();

      // Wait for projects to load
      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });

      // Find and click edit button for first project
      const projectCards = screen.getAllByRole('button', { name: /edit project/i });
      await user.click(projectCards[0]);

      // Modal should open with tabs
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Project Settings')).toBeInTheDocument();
      });

      // Should show both tabs
      expect(screen.getByRole('tab', { name: /general settings/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /taxonomy settings/i })).toBeInTheDocument();
    });

    it('should show tabs for any existing project being edited', async () => {
      renderProjectsPage();

      // Wait for projects to load
      await waitFor(() => {
        expect(screen.getByText('Another Project')).toBeInTheDocument();
      });

      // Find and click edit button for second project
      const projectCards = screen.getAllByRole('button', { name: /edit project/i });
      await user.click(projectCards[1]);

      // Modal should open with tabs
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Project Settings')).toBeInTheDocument();
      });

      // Should show both tabs
      expect(screen.getByRole('tab', { name: /general settings/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /taxonomy settings/i })).toBeInTheDocument();
    });
  });

  // ============================================================================
  // TAB SWITCHING TESTS
  // ============================================================================

  describe('Tab Switching', () => {
    it('should default to General Settings tab when modal opens', async () => {
      renderProjectsPage();

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: /edit project/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // General Settings tab should be selected by default
      const generalTab = screen.getByRole('tab', { name: /general settings/i });
      expect(generalTab).toHaveAttribute('aria-selected', 'true');

      // Should show general settings form
      expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it('should switch to Taxonomy Settings tab when clicked', async () => {
      renderProjectsPage();

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: /edit project/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click Taxonomy Settings tab
      const taxonomyTab = screen.getByRole('tab', { name: /taxonomy settings/i });
      await user.click(taxonomyTab);

      // Taxonomy tab should now be selected
      await waitFor(() => {
        expect(taxonomyTab).toHaveAttribute('aria-selected', 'true');
      });

      // Should show TaxonomyManager component
      expect(screen.getByTestId('taxonomy-manager')).toBeInTheDocument();
    });

    it('should switch back to General Settings tab', async () => {
      renderProjectsPage();

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: /edit project/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click Taxonomy tab
      const taxonomyTab = screen.getByRole('tab', { name: /taxonomy settings/i });
      await user.click(taxonomyTab);

      await waitFor(() => {
        expect(screen.getByTestId('taxonomy-manager')).toBeInTheDocument();
      });

      // Click back to General Settings tab
      const generalTab = screen.getByRole('tab', { name: /general settings/i });
      await user.click(generalTab);

      // General tab should be selected
      await waitFor(() => {
        expect(generalTab).toHaveAttribute('aria-selected', 'true');
      });

      // Should show form fields again
      expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it('should maintain tab state when switching between tabs multiple times', async () => {
      renderProjectsPage();

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: /edit project/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const generalTab = screen.getByRole('tab', { name: /general settings/i });
      const taxonomyTab = screen.getByRole('tab', { name: /taxonomy settings/i });

      // Switch to Taxonomy
      await user.click(taxonomyTab);
      await waitFor(() => {
        expect(taxonomyTab).toHaveAttribute('aria-selected', 'true');
      });

      // Switch back to General
      await user.click(generalTab);
      await waitFor(() => {
        expect(generalTab).toHaveAttribute('aria-selected', 'true');
      });

      // Switch to Taxonomy again
      await user.click(taxonomyTab);
      await waitFor(() => {
        expect(taxonomyTab).toHaveAttribute('aria-selected', 'true');
      });

      // TaxonomyManager should still be rendered
      expect(screen.getByTestId('taxonomy-manager')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('TaxonomyManager Integration', () => {
    it('should render TaxonomyManager with correct projectId when Taxonomy tab selected', async () => {
      renderProjectsPage();

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });

      // Open edit modal for first project
      const editButtons = screen.getAllByRole('button', { name: /edit project/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Switch to Taxonomy tab
      const taxonomyTab = screen.getByRole('tab', { name: /taxonomy settings/i });
      await user.click(taxonomyTab);

      // TaxonomyManager should be rendered with correct projectId
      await waitFor(() => {
        const taxonomyManager = screen.getByTestId('taxonomy-manager');
        expect(taxonomyManager).toBeInTheDocument();
        expect(taxonomyManager).toHaveAttribute('data-project-id', 'project-1');
      });
    });

    it('should render TaxonomyManager with different projectId for different project', async () => {
      renderProjectsPage();

      await waitFor(() => {
        expect(screen.getByText('Another Project')).toBeInTheDocument();
      });

      // Open edit modal for second project
      const editButtons = screen.getAllByRole('button', { name: /edit project/i });
      await user.click(editButtons[1]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Switch to Taxonomy tab
      const taxonomyTab = screen.getByRole('tab', { name: /taxonomy settings/i });
      await user.click(taxonomyTab);

      // TaxonomyManager should be rendered with second project's ID
      await waitFor(() => {
        const taxonomyManager = screen.getByTestId('taxonomy-manager');
        expect(taxonomyManager).toBeInTheDocument();
        expect(taxonomyManager).toHaveAttribute('data-project-id', 'project-2');
      });
    });

    it('should NOT render TaxonomyManager when in General Settings tab', async () => {
      renderProjectsPage();

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: /edit project/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Should be on General tab by default - TaxonomyManager should NOT be rendered
      expect(screen.queryByTestId('taxonomy-manager')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // FORM FUNCTIONALITY TESTS
  // ============================================================================

  describe('General Settings Form with Tabs', () => {
    it('should still allow editing project name in General Settings tab', async () => {
      renderProjectsPage();

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: /edit project/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Should be on General tab - edit name
      const nameInput = screen.getByLabelText(/project name/i) as HTMLInputElement;
      expect(nameInput.value).toBe('Test Project');

      // Clear and type new name
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Project Name');

      expect(nameInput.value).toBe('Updated Project Name');
    });

    it('should still allow editing project description in General Settings tab', async () => {
      renderProjectsPage();

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: /edit project/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Edit description
      const descInput = screen.getByLabelText(/description/i) as HTMLTextAreaElement;
      expect(descInput.value).toBe('Test project description');

      await user.clear(descInput);
      await user.type(descInput, 'Updated description');

      expect(descInput.value).toBe('Updated description');
    });

    it('should submit form from General Settings tab', async () => {
      renderProjectsPage();

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: /edit project/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Edit name
      const nameInput = screen.getByLabelText(/project name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'New Name');

      // Submit form
      const updateButton = screen.getByRole('button', { name: /update project/i });
      await user.click(updateButton);

      // Should call update service
      await waitFor(() => {
        expect(projectsService.update).toHaveBeenCalledWith(
          'project-1',
          expect.objectContaining({
            name: 'New Name',
          })
        );
      });
    });

    it('should show form validation error when name is empty in General Settings tab', async () => {
      renderProjectsPage();

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: /edit project/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Clear name (required field)
      const nameInput = screen.getByLabelText(/project name/i);
      await user.clear(nameInput);

      // Try to submit
      const updateButton = screen.getByRole('button', { name: /update project/i });
      await user.click(updateButton);

      // Should NOT call update service (HTML5 validation should prevent it)
      expect(projectsService.update).not.toHaveBeenCalled();
    });

    it('should close modal when cancel button clicked in General Settings tab', async () => {
      renderProjectsPage();

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: /edit project/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should preserve form state when switching tabs', async () => {
      renderProjectsPage();

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: /edit project/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Edit name in General tab
      const nameInput = screen.getByLabelText(/project name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Modified Name');

      // Switch to Taxonomy tab
      const taxonomyTab = screen.getByRole('tab', { name: /taxonomy settings/i });
      await user.click(taxonomyTab);

      await waitFor(() => {
        expect(screen.getByTestId('taxonomy-manager')).toBeInTheDocument();
      });

      // Switch back to General tab
      const generalTab = screen.getByRole('tab', { name: /general settings/i });
      await user.click(generalTab);

      // Form state should be preserved
      await waitFor(() => {
        const nameInputAfter = screen.getByLabelText(/project name/i) as HTMLInputElement;
        expect(nameInputAfter.value).toBe('Modified Name');
      });
    });
  });

  // ============================================================================
  // EDGE CASES AND ACCESSIBILITY
  // ============================================================================

  describe('Edge Cases and Accessibility', () => {
    it('should have proper ARIA attributes for tabs', async () => {
      renderProjectsPage();

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: /edit project/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Check ARIA attributes
      const generalTab = screen.getByRole('tab', { name: /general settings/i });
      const taxonomyTab = screen.getByRole('tab', { name: /taxonomy settings/i });

      expect(generalTab).toHaveAttribute('aria-selected');
      expect(taxonomyTab).toHaveAttribute('aria-selected');
    });

    it('should support keyboard navigation between tabs', async () => {
      renderProjectsPage();

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: /edit project/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const generalTab = screen.getByRole('tab', { name: /general settings/i });
      const taxonomyTab = screen.getByRole('tab', { name: /taxonomy settings/i });

      // Focus first tab
      generalTab.focus();
      expect(generalTab).toHaveFocus();

      // Use arrow key to navigate to next tab (Headless UI uses arrow keys for tab navigation)
      await user.keyboard('{ArrowRight}');
      expect(taxonomyTab).toHaveFocus();
    });

    it('should reset to General Settings tab when modal reopens', async () => {
      renderProjectsPage();

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: /edit project/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Switch to Taxonomy tab
      const taxonomyTab = screen.getByRole('tab', { name: /taxonomy settings/i });
      await user.click(taxonomyTab);

      await waitFor(() => {
        expect(taxonomyTab).toHaveAttribute('aria-selected', 'true');
      });

      // Close modal (Taxonomy tab has "Close" button)
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Reopen modal
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Should default back to General Settings tab
      const generalTab = screen.getByRole('tab', { name: /general settings/i });
      expect(generalTab).toHaveAttribute('aria-selected', 'true');
    });
  });
});
