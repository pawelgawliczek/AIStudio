import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { versioningService } from '../../services/versioning.service';
import {
  VersionBumpModal,
  calculateNextVersion,
  validateForm,
} from '../VersionBumpModal';

// Mock the versioning service
vi.mock('../../services/versioning.service', () => ({
  versioningService: {
    createComponentVersion: vi.fn(),
    createCoordinatorVersion: vi.fn(),
    createWorkflowVersion: vi.fn(),
  },
}));

describe('VersionBumpModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    entityType: 'component' as const,
    entityId: 'test-component-id',
    entityName: 'Test Component',
    currentVersion: 'v1.5',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering Tests', () => {
    it('renders with correct current version', () => {
      render(<VersionBumpModal {...defaultProps} />);
      expect(screen.getByText('v1.5')).toBeInTheDocument();
    });

    it('displays entity name in modal', () => {
      render(<VersionBumpModal {...defaultProps} />);
      expect(screen.getByText('Test Component')).toBeInTheDocument();
    });

    it('shows "Minor Version" selected by default', () => {
      render(<VersionBumpModal {...defaultProps} />);
      const minorRadio = screen.getByLabelText(/Minor Version/i);
      expect(minorRadio).toBeChecked();
    });

    it('renders modal title', () => {
      render(<VersionBumpModal {...defaultProps} />);
      expect(screen.getByText('Create New Version')).toBeInTheDocument();
    });

    it('renders version preview section', () => {
      render(<VersionBumpModal {...defaultProps} />);
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    it('renders change description textarea', () => {
      render(<VersionBumpModal {...defaultProps} />);
      expect(
        screen.getByPlaceholderText(/Describe the changes/i)
      ).toBeInTheDocument();
    });

    it('renders Cancel and Create Version buttons', () => {
      render(<VersionBumpModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Version/i })).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<VersionBumpModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Create New Version')).not.toBeInTheDocument();
    });
  });

  describe('Interaction Tests', () => {
    it('switches between minor and major radio buttons', async () => {
      const user = userEvent.setup();
      render(<VersionBumpModal {...defaultProps} />);

      const minorRadio = screen.getByLabelText(/Minor Version/i);
      const majorRadio = screen.getByLabelText(/Major Version/i);

      expect(minorRadio).toBeChecked();
      expect(majorRadio).not.toBeChecked();

      await user.click(majorRadio);

      expect(minorRadio).not.toBeChecked();
      expect(majorRadio).toBeChecked();
    });

    it('updates version preview when radio changes from minor to major', async () => {
      const user = userEvent.setup();
      render(<VersionBumpModal {...defaultProps} />);

      // Initial state: minor version preview (v1.5 → v1.6)
      expect(screen.getByText('v1.6')).toBeInTheDocument();

      // Click major version radio
      const majorRadio = screen.getByLabelText(/Major Version/i);
      await user.click(majorRadio);

      // Preview should update to v2.0
      await waitFor(() => {
        expect(screen.getByText('v2.0')).toBeInTheDocument();
      });
    });

    it('updates version preview when radio changes from major to minor', async () => {
      const user = userEvent.setup();
      render(<VersionBumpModal {...defaultProps} />);

      // Click major version radio
      const majorRadio = screen.getByLabelText(/Major Version/i);
      await user.click(majorRadio);

      await waitFor(() => {
        expect(screen.getByText('v2.0')).toBeInTheDocument();
      });

      // Click minor version radio
      const minorRadio = screen.getByLabelText(/Minor Version/i);
      await user.click(minorRadio);

      // Preview should update back to v1.6
      await waitFor(() => {
        expect(screen.getByText('v1.6')).toBeInTheDocument();
      });
    });

    it('captures change description input', async () => {
      const user = userEvent.setup();
      render(<VersionBumpModal {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(/Describe the changes/i);
      await user.type(textarea, 'Fixed validation bug');

      expect(textarea).toHaveValue('Fixed validation bug');
    });

    it('closes modal on cancel button click', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<VersionBumpModal {...defaultProps} onClose={onClose} />);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes modal on ESC key press', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<VersionBumpModal {...defaultProps} onClose={onClose} />);

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalled();
    });

    it('closes modal on close button (X) click', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<VersionBumpModal {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: /Close/i });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('API Integration Tests - Component', () => {
    it('calls correct API endpoint for minor version bump', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      vi.mocked(versioningService.createComponentVersion).mockResolvedValue({
        id: 'new-version-id',
        componentId: 'test-component-id',
        versionMajor: 1,
        versionMinor: 6,
        version: 'v1.6',
        inputInstructions: 'test',
        operationInstructions: 'test',
        outputInstructions: 'test',
        config: { modelId: 'test', temperature: 0.7 },
        tools: [],
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      render(
        <VersionBumpModal {...defaultProps} onSuccess={onSuccess} />
      );

      const submitButton = screen.getByRole('button', { name: /Create Version/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(versioningService.createComponentVersion).toHaveBeenCalledWith(
          'test-component-id',
          expect.objectContaining({
            changeDescription: undefined,
          })
        );
      });

      expect(onSuccess).toHaveBeenCalledWith('v1.6');
    });

    it('calls correct API endpoint for major version bump', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      vi.mocked(versioningService.createComponentVersion).mockResolvedValue({
        id: 'new-version-id',
        componentId: 'test-component-id',
        versionMajor: 2,
        versionMinor: 0,
        version: 'v2.0',
        inputInstructions: 'test',
        operationInstructions: 'test',
        outputInstructions: 'test',
        config: { modelId: 'test', temperature: 0.7 },
        tools: [],
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      render(
        <VersionBumpModal {...defaultProps} onSuccess={onSuccess} />
      );

      const majorRadio = screen.getByLabelText(/Major Version/i);
      await user.click(majorRadio);

      const submitButton = screen.getByRole('button', { name: /Create Version/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(versioningService.createComponentVersion).toHaveBeenCalledWith(
          'test-component-id',
          expect.objectContaining({
            majorVersion: 2,
            changeDescription: undefined,
          })
        );
      });

      expect(onSuccess).toHaveBeenCalledWith('v2.0');
    });

    it('passes change description to API', async () => {
      const user = userEvent.setup();

      vi.mocked(versioningService.createComponentVersion).mockResolvedValue({
        id: 'new-version-id',
        componentId: 'test-component-id',
        versionMajor: 1,
        versionMinor: 6,
        version: 'v1.6',
        inputInstructions: 'test',
        operationInstructions: 'test',
        outputInstructions: 'test',
        config: { modelId: 'test', temperature: 0.7 },
        tools: [],
        active: true,
        changeDescription: 'Fixed bug',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      render(<VersionBumpModal {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(/Describe the changes/i);
      await user.type(textarea, 'Fixed bug');

      const submitButton = screen.getByRole('button', { name: /Create Version/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(versioningService.createComponentVersion).toHaveBeenCalledWith(
          'test-component-id',
          expect.objectContaining({
            changeDescription: 'Fixed bug',
          })
        );
      });
    });

    it('handles API success and calls onSuccess callback', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      const onClose = vi.fn();

      vi.mocked(versioningService.createComponentVersion).mockResolvedValue({
        id: 'new-version-id',
        componentId: 'test-component-id',
        versionMajor: 1,
        versionMinor: 6,
        version: 'v1.6',
        inputInstructions: 'test',
        operationInstructions: 'test',
        outputInstructions: 'test',
        config: { modelId: 'test', temperature: 0.7 },
        tools: [],
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      render(
        <VersionBumpModal
          {...defaultProps}
          onSuccess={onSuccess}
          onClose={onClose}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Create Version/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith('v1.6');
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('API Integration Tests - Coordinator', () => {
    it('calls coordinator endpoint for coordinator entity type', async () => {
      const user = userEvent.setup();

      vi.mocked(versioningService.createCoordinatorVersion).mockResolvedValue({
        id: 'new-version-id',
        coordinatorId: 'test-coordinator-id',
        versionMajor: 1,
        versionMinor: 6,
        version: 'v1.6',
        coordinatorInstructions: 'test',
        decisionStrategy: 'sequential',
        config: { modelId: 'test', temperature: 0.7 },
        tools: [],
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      render(
        <VersionBumpModal
          {...defaultProps}
          entityType="coordinator"
          entityId="test-coordinator-id"
        />
      );

      const submitButton = screen.getByRole('button', { name: /Create Version/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(versioningService.createCoordinatorVersion).toHaveBeenCalledWith(
          'test-coordinator-id',
          expect.any(Object)
        );
      });
    });
  });

  describe('API Integration Tests - Workflow', () => {
    it('calls workflow endpoint for workflow entity type', async () => {
      const user = userEvent.setup();

      vi.mocked(versioningService.createWorkflowVersion).mockResolvedValue({
        id: 'new-version-id',
        workflowId: 'test-workflow-id',
        versionMajor: 1,
        versionMinor: 6,
        version: 'v1.6',
        coordinatorId: 'coordinator-id',
        coordinatorVersion: 'v1.0',
        triggerConfig: { type: 'manual' },
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      render(
        <VersionBumpModal
          {...defaultProps}
          entityType="workflow"
          entityId="test-workflow-id"
        />
      );

      const submitButton = screen.getByRole('button', { name: /Create Version/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(versioningService.createWorkflowVersion).toHaveBeenCalledWith(
          'test-workflow-id',
          expect.any(Object)
        );
      });
    });
  });

  describe('Error Handling Tests', () => {
    it('displays error message on API failure', async () => {
      const user = userEvent.setup();

      vi.mocked(versioningService.createComponentVersion).mockRejectedValue(
        new Error('Network error')
      );

      render(<VersionBumpModal {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Create Version/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('calls onError callback on API failure', async () => {
      const user = userEvent.setup();
      const onError = vi.fn();

      vi.mocked(versioningService.createComponentVersion).mockRejectedValue(
        new Error('API error')
      );

      render(<VersionBumpModal {...defaultProps} onError={onError} />);

      const submitButton = screen.getByRole('button', { name: /Create Version/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    it('shows error for change description over 500 characters', async () => {
      const user = userEvent.setup();
      render(<VersionBumpModal {...defaultProps} />);

      const longText = 'a'.repeat(501);
      const textarea = screen.getByPlaceholderText(/Describe the changes/i);
      await user.type(textarea, longText);

      const submitButton = screen.getByRole('button', { name: /Create Version/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/must not exceed 500 characters/i)
        ).toBeInTheDocument();
      });
    });

    it('disables submit button when over character limit', async () => {
      const user = userEvent.setup();
      render(<VersionBumpModal {...defaultProps} />);

      const longText = 'a'.repeat(501);
      const textarea = screen.getByPlaceholderText(/Describe the changes/i);
      await user.type(textarea, longText);

      const submitButton = screen.getByRole('button', { name: /Create Version/i });
      expect(submitButton).toBeDisabled();
    });

    it('displays character count', async () => {
      const user = userEvent.setup();
      render(<VersionBumpModal {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(/Describe the changes/i);
      await user.type(textarea, 'Test');

      expect(screen.getByText('4 / 500 characters')).toBeInTheDocument();
    });

    it('highlights character count in red when over limit', async () => {
      const user = userEvent.setup();
      render(<VersionBumpModal {...defaultProps} />);

      const longText = 'a'.repeat(501);
      const textarea = screen.getByPlaceholderText(/Describe the changes/i);
      await user.type(textarea, longText);

      const counter = screen.getByText(/501 \/ 500 characters/i);
      expect(counter).toHaveClass('text-red-600');
    });
  });

  describe('Loading State Tests', () => {
    it('shows loading state during API call', async () => {
      const user = userEvent.setup();

      // Create a promise that never resolves to keep loading state
      let resolvePromise: any;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(versioningService.createComponentVersion).mockReturnValue(
        pendingPromise as any
      );

      render(<VersionBumpModal {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Create Version/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Creating.../i })).toBeInTheDocument();
      });

      // Cleanup
      resolvePromise({
        id: 'id',
        componentId: 'id',
        versionMajor: 1,
        versionMinor: 6,
        version: 'v1.6',
        inputInstructions: '',
        operationInstructions: '',
        outputInstructions: '',
        config: { modelId: 'test', temperature: 0.7 },
        tools: [],
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    it('disables buttons during API call', async () => {
      const user = userEvent.setup();

      let resolvePromise: any;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(versioningService.createComponentVersion).mockReturnValue(
        pendingPromise as any
      );

      render(<VersionBumpModal {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Create Version/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Creating.../i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
      });

      // Cleanup
      resolvePromise({
        id: 'id',
        componentId: 'id',
        versionMajor: 1,
        versionMinor: 6,
        version: 'v1.6',
        inputInstructions: '',
        operationInstructions: '',
        outputInstructions: '',
        config: { modelId: 'test', temperature: 0.7 },
        tools: [],
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
  });

  describe('Form Reset Tests', () => {
    it('resets form when modal reopens', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<VersionBumpModal {...defaultProps} />);

      // Fill form
      const textarea = screen.getByPlaceholderText(/Describe the changes/i);
      await user.type(textarea, 'Test description');

      const majorRadio = screen.getByLabelText(/Major Version/i);
      await user.click(majorRadio);

      // Close modal
      rerender(<VersionBumpModal {...defaultProps} isOpen={false} />);

      // Reopen modal
      rerender(<VersionBumpModal {...defaultProps} isOpen={true} />);

      // Form should be reset
      expect(screen.getByPlaceholderText(/Describe the changes/i)).toHaveValue('');
      expect(screen.getByLabelText(/Minor Version/i)).toBeChecked();
    });
  });

  describe('Accessibility Tests', () => {
    it('has proper ARIA labels for radio group', () => {
      render(<VersionBumpModal {...defaultProps} />);
      const radioGroup = screen.getByRole('radiogroup');
      expect(radioGroup).toHaveAttribute('aria-label', 'Version type selection');
    });

    it('announces version preview updates', () => {
      render(<VersionBumpModal {...defaultProps} />);
      const previewSection = screen.getByRole('status');
      expect(previewSection).toHaveAttribute('aria-live', 'polite');
    });

    it('announces errors with aria-live', async () => {
      const user = userEvent.setup();

      vi.mocked(versioningService.createComponentVersion).mockRejectedValue(
        new Error('Test error')
      );

      render(<VersionBumpModal {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Create Version/i });
      await user.click(submitButton);

      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveAttribute('aria-live', 'assertive');
      });
    });

    it('labels change description textarea correctly', () => {
      render(<VersionBumpModal {...defaultProps} />);
      const textarea = screen.getByLabelText(/Change Description/i);
      expect(textarea).toBeInTheDocument();
    });

    it('associates character counter with textarea', () => {
      render(<VersionBumpModal {...defaultProps} />);
      const textarea = screen.getByPlaceholderText(/Describe the changes/i);
      expect(textarea).toHaveAttribute('aria-describedby', 'changeDescription-counter');
    });
  });
});

describe('Helper Functions', () => {
  describe('calculateNextVersion', () => {
    it('calculates minor version bump correctly', () => {
      expect(calculateNextVersion('v1.5', 'minor')).toBe('v1.6');
    });

    it('calculates major version bump correctly', () => {
      expect(calculateNextVersion('v1.5', 'major')).toBe('v2.0');
    });

    it('handles version without "v" prefix', () => {
      expect(calculateNextVersion('1.5', 'minor')).toBe('v1.6');
      expect(calculateNextVersion('1.5', 'major')).toBe('v2.0');
    });

    it('handles version at v0.9', () => {
      expect(calculateNextVersion('v0.9', 'minor')).toBe('v0.10');
      expect(calculateNextVersion('v0.9', 'major')).toBe('v1.0');
    });

    it('handles high version numbers', () => {
      expect(calculateNextVersion('v99.99', 'minor')).toBe('v99.100');
      expect(calculateNextVersion('v99.99', 'major')).toBe('v100.0');
    });

    it('returns v1.0 for invalid version format', () => {
      expect(calculateNextVersion('invalid', 'minor')).toBe('v1.0');
      expect(calculateNextVersion('v1', 'minor')).toBe('v1.0');
      expect(calculateNextVersion('', 'minor')).toBe('v1.0');
    });
  });

  describe('validateForm', () => {
    it('validates form with valid data', () => {
      const result = validateForm({
        versionType: 'minor',
        changeDescription: 'Valid description',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates form with empty description', () => {
      const result = validateForm({
        versionType: 'minor',
        changeDescription: '',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('invalidates form with description over 500 characters', () => {
      const result = validateForm({
        versionType: 'minor',
        changeDescription: 'a'.repeat(501),
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Change description must not exceed 500 characters');
    });

    it('validates form at exactly 500 characters', () => {
      const result = validateForm({
        versionType: 'minor',
        changeDescription: 'a'.repeat(500),
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
