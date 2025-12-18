/**
 * React Component Tests for TaxonomyManager
 * Tests taxonomy management UI and user interactions
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { taxonomyService } from '../../../services/taxonomy.service';
import { TaxonomyManager } from '../TaxonomyManager';

// Mock the taxonomy service
vi.mock('../../../services/taxonomy.service', () => ({
  taxonomyService: {
    listAreas: vi.fn(),
    addArea: vi.fn(),
    removeArea: vi.fn(),
    renameArea: vi.fn(),
    mergeAreas: vi.fn(),
    validateArea: vi.fn(),
    getSuggestions: vi.fn(),
  },
}));

describe('TaxonomyManager', () => {
  const mockProjectId = 'project-123';
  const mockAreas = [
    { area: 'Authentication', usageCount: 10 },
    { area: 'Authorization', usageCount: 5 },
    { area: 'User Management', usageCount: 3 },
    { area: 'Reporting', usageCount: 2 },
    { area: 'Billing', usageCount: 0 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (taxonomyService.listAreas as any).mockResolvedValue(mockAreas);
  });

  describe('Rendering', () => {
    it('should render taxonomy manager component', async () => {
      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByText('Taxonomy Settings')).toBeInTheDocument();
      });
    });

    it('should display all taxonomy areas', async () => {
      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByText('Authentication')).toBeInTheDocument();
        expect(screen.getByText('Authorization')).toBeInTheDocument();
        expect(screen.getByText('User Management')).toBeInTheDocument();
        expect(screen.getByText('Reporting')).toBeInTheDocument();
        expect(screen.getByText('Billing')).toBeInTheDocument();
      });
    });

    it('should display usage counts for each area', async () => {
      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByText('10 use cases')).toBeInTheDocument();
        expect(screen.getByText('5 use cases')).toBeInTheDocument();
        expect(screen.getByText('3 use cases')).toBeInTheDocument();
      });
    });

    it('should display Add Area button', async () => {
      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add area/i })).toBeInTheDocument();
      });
    });

    it('should display area count', async () => {
      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByText(/Areas \(5\)/i)).toBeInTheDocument();
      });
    });

    it('should display loading state initially', () => {
      render(<TaxonomyManager projectId={mockProjectId} />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should display empty state when no areas', async () => {
      (taxonomyService.listAreas as any).mockResolvedValue([]);

      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByText(/no taxonomy areas/i)).toBeInTheDocument();
      });
    });

    it('should display error state on load failure', async () => {
      (taxonomyService.listAreas as any).mockRejectedValue(new Error('Failed to load'));

      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByText(/error loading/i)).toBeInTheDocument();
      });
    });
  });

  describe('Add Area', () => {
    it('should open add area dialog when button clicked', async () => {
      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add area/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /add area/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter area name/i)).toBeInTheDocument();
      });
    });

    it('should add new area successfully', async () => {
      (taxonomyService.addArea as any).mockResolvedValue({
        added: 'API Gateway',
        taxonomy: [...mockAreas.map((a) => a.area), 'API Gateway'],
      });

      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add area/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /add area/i }));

      const input = await screen.findByPlaceholderText(/enter area name/i);
      await userEvent.type(input, 'API Gateway');

      const submitButton = screen.getByRole('button', { name: /add/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(taxonomyService.addArea).toHaveBeenCalledWith(mockProjectId, 'API Gateway');
      });
    });

    it('should show similarity warnings when adding similar area', async () => {
      (taxonomyService.validateArea as any).mockResolvedValue({
        valid: false,
        suggestions: [{ area: 'Authentication', distance: 1 }],
      });

      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add area/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /add area/i }));

      const input = await screen.findByPlaceholderText(/enter area name/i);
      await userEvent.type(input, 'Authentcation');

      await waitFor(() => {
        expect(screen.getByText(/similar area exists/i)).toBeInTheDocument();
        expect(screen.getByText('Authentication')).toBeInTheDocument();
      });
    });

    it('should prevent adding duplicate area', async () => {
      (taxonomyService.addArea as any).mockRejectedValue(
        new Error('Area already exists')
      );

      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add area/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /add area/i }));

      const input = await screen.findByPlaceholderText(/enter area name/i);
      await userEvent.type(input, 'Authentication');

      const submitButton = screen.getByRole('button', { name: /add/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      });
    });

    it('should validate area name is not empty', async () => {
      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add area/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /add area/i }));

      const submitButton = await screen.findByRole('button', { name: /add/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/area name is required/i)).toBeInTheDocument();
      });
    });

    it('should close dialog after successful add', async () => {
      (taxonomyService.addArea as any).mockResolvedValue({
        added: 'New Area',
        taxonomy: [...mockAreas.map((a) => a.area), 'New Area'],
      });

      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add area/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /add area/i }));

      const input = await screen.findByPlaceholderText(/enter area name/i);
      await userEvent.type(input, 'New Area');

      const submitButton = screen.getByRole('button', { name: /add/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/enter area name/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Remove Area', () => {
    it('should show delete button for each area', async () => {
      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
        expect(deleteButtons.length).toBe(5);
      });
    });

    it('should show confirmation dialog when deleting area', async () => {
      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
        fireEvent.click(deleteButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      });
    });

    it('should delete area after confirmation', async () => {
      (taxonomyService.removeArea as any).mockResolvedValue({
        removed: 'Billing',
        taxonomy: mockAreas.filter((a) => a.area !== 'Billing').map((a) => a.area),
      });

      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
        fireEvent.click(deleteButtons[4]); // Billing (last one)
      });

      const confirmButton = await screen.findByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(taxonomyService.removeArea).toHaveBeenCalledWith(
          mockProjectId,
          'Billing',
          false
        );
      });
    });

    it('should warn when deleting area with use cases', async () => {
      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
        fireEvent.click(deleteButtons[0]); // Authentication with 10 use cases
      });

      await waitFor(() => {
        expect(screen.getByText(/10 use cases/i)).toBeInTheDocument();
        expect(screen.getByText(/will be orphaned/i)).toBeInTheDocument();
      });
    });

    it('should require force flag for area with use cases', async () => {
      (taxonomyService.removeArea as any).mockRejectedValue(
        new Error('Area has 10 use cases')
      );

      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
        fireEvent.click(deleteButtons[0]);
      });

      const confirmButton = await screen.findByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/use cases/i)).toBeInTheDocument();
      });
    });

    it('should cancel deletion when cancel clicked', async () => {
      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
        fireEvent.click(deleteButtons[0]);
      });

      const cancelButton = await screen.findByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
      });

      expect(taxonomyService.removeArea).not.toHaveBeenCalled();
    });
  });

  describe('Rename Area', () => {
    it('should enable inline editing on double-click', async () => {
      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        const areaText = screen.getByText('Authentication');
        fireEvent.doubleClick(areaText);
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('Authentication')).toBeInTheDocument();
      });
    });

    it('should rename area successfully', async () => {
      (taxonomyService.renameArea as any).mockResolvedValue({
        renamed: { from: 'Authentication', to: 'Security' },
        useCasesUpdated: 10,
      });

      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        const areaText = screen.getByText('Authentication');
        fireEvent.doubleClick(areaText);
      });

      const input = await screen.findByDisplayValue('Authentication');
      await userEvent.clear(input);
      await userEvent.type(input, 'Security');
      fireEvent.blur(input);

      await waitFor(() => {
        expect(taxonomyService.renameArea).toHaveBeenCalledWith(
          mockProjectId,
          'Authentication',
          'Security'
        );
      });
    });

    it('should show success message after rename', async () => {
      (taxonomyService.renameArea as any).mockResolvedValue({
        renamed: { from: 'Authentication', to: 'Security' },
        useCasesUpdated: 10,
      });

      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        const areaText = screen.getByText('Authentication');
        fireEvent.doubleClick(areaText);
      });

      const input = await screen.findByDisplayValue('Authentication');
      await userEvent.clear(input);
      await userEvent.type(input, 'Security');
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText(/10 use cases updated/i)).toBeInTheDocument();
      });
    });

    it('should cancel rename on Escape key', async () => {
      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        const areaText = screen.getByText('Authentication');
        fireEvent.doubleClick(areaText);
      });

      const input = await screen.findByDisplayValue('Authentication');
      await userEvent.clear(input);
      await userEvent.type(input, 'Security');
      fireEvent.keyDown(input, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByDisplayValue('Security')).not.toBeInTheDocument();
        expect(screen.getByText('Authentication')).toBeInTheDocument();
      });

      expect(taxonomyService.renameArea).not.toHaveBeenCalled();
    });

    it('should prevent rename to existing area', async () => {
      (taxonomyService.renameArea as any).mockRejectedValue(
        new Error('Area already exists')
      );

      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        const areaText = screen.getByText('Billing');
        fireEvent.doubleClick(areaText);
      });

      const input = await screen.findByDisplayValue('Billing');
      await userEvent.clear(input);
      await userEvent.type(input, 'Authentication');
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      });
    });
  });

  describe('Merge Areas', () => {
    it('should enable checkboxes for multi-select', async () => {
      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThan(0);
      });
    });

    it('should show merge button when multiple areas selected', async () => {
      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[0]); // Authentication
        fireEvent.click(checkboxes[1]); // Authorization
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /merge selected/i })).toBeEnabled();
      });
    });

    it('should merge multiple areas into target', async () => {
      (taxonomyService.mergeAreas as any).mockResolvedValue({
        merged: { from: ['Authentication', 'Authorization'], to: 'Security' },
        useCasesUpdated: 15,
      });

      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[0]);
        fireEvent.click(checkboxes[1]);
      });

      const mergeButton = screen.getByRole('button', { name: /merge selected/i });
      fireEvent.click(mergeButton);

      const targetInput = await screen.findByPlaceholderText(/target area name/i);
      await userEvent.type(targetInput, 'Security');

      const confirmButton = screen.getByRole('button', { name: /merge/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(taxonomyService.mergeAreas).toHaveBeenCalledWith(
          mockProjectId,
          ['Authentication', 'Authorization'],
          'Security'
        );
      });
    });

    it('should disable merge button with less than 2 selections', async () => {
      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[0]);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /merge selected/i })).toBeDisabled();
      });
    });

    it('should clear selection after successful merge', async () => {
      (taxonomyService.mergeAreas as any).mockResolvedValue({
        merged: { from: ['Billing', 'Reporting'], to: 'Finance' },
        useCasesUpdated: 2,
      });

      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[3]); // Reporting
        fireEvent.click(checkboxes[4]); // Billing
      });

      const mergeButton = screen.getByRole('button', { name: /merge selected/i });
      fireEvent.click(mergeButton);

      const targetInput = await screen.findByPlaceholderText(/target area name/i);
      await userEvent.type(targetInput, 'Finance');

      const confirmButton = screen.getByRole('button', { name: /merge/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        checkboxes.forEach((checkbox) => {
          expect(checkbox).not.toBeChecked();
        });
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add area/i })).toHaveAttribute(
          'aria-label'
        );
      });
    });

    it('should support keyboard navigation', async () => {
      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /add area/i });
        addButton.focus();
        expect(addButton).toHaveFocus();
      });
    });

    it('should announce success messages to screen readers', async () => {
      (taxonomyService.addArea as any).mockResolvedValue({
        added: 'New Area',
        taxonomy: [...mockAreas.map((a) => a.area), 'New Area'],
      });

      render(<TaxonomyManager projectId={mockProjectId} />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /add area/i }));
      });

      const input = await screen.findByPlaceholderText(/enter area name/i);
      await userEvent.type(input, 'New Area');

      const submitButton = screen.getByRole('button', { name: /add/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(/successfully added/i);
      });
    });
  });
});
