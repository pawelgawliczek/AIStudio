/**
 * Unit tests for ArtifactPanel component
 * ST-168: Artifact quick access UI
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArtifactPanel, Artifact } from '../ArtifactPanel';

describe('ArtifactPanel', () => {
  const mockArtifacts: Artifact[] = [
    {
      id: 'a1',
      definitionKey: 'BA_ANALYSIS',
      name: 'Business Analysis',
      type: 'markdown',
      status: 'complete',
      version: 2,
      createdBy: 'Analysis Agent',
      size: 2450,
      preview: '# Business Analysis\n## Requirements\n- User authentication...',
    },
    {
      id: 'a2',
      definitionKey: 'ARCH_DOC',
      name: 'Architecture Document',
      type: 'markdown',
      status: 'writing',
      version: 1,
      createdBy: 'Architecture Agent',
      size: 5100,
    },
    {
      id: 'a3',
      definitionKey: 'IMPL_CODE',
      name: 'Implementation Code',
      type: 'code',
      status: 'pending',
      version: 0,
    },
  ];

  const defaultHandlers = {
    onView: vi.fn(),
    onEdit: vi.fn(),
    onDownload: vi.fn(),
    onViewHistory: vi.fn(),
  };

  describe('TC-ARTIFACT-001: Basic rendering', () => {
    it('should render artifact panel with all artifacts', () => {
      render(<ArtifactPanel artifacts={mockArtifacts} {...defaultHandlers} />);

      expect(screen.getByTestId('artifact-panel')).toBeInTheDocument();
      expect(screen.getByText('Business Analysis')).toBeInTheDocument();
      expect(screen.getByText('Architecture Document')).toBeInTheDocument();
      expect(screen.getByText('Implementation Code')).toBeInTheDocument();
    });

    it('should display artifact definition key', () => {
      render(<ArtifactPanel artifacts={mockArtifacts} {...defaultHandlers} />);

      expect(screen.getByText('(BA_ANALYSIS)')).toBeInTheDocument();
    });

    it('should display version number', () => {
      render(<ArtifactPanel artifacts={mockArtifacts} {...defaultHandlers} />);

      expect(screen.getByText('v2')).toBeInTheDocument();
    });
  });

  describe('TC-ARTIFACT-002: Status indicators', () => {
    it('should show complete status for completed artifacts', () => {
      render(<ArtifactPanel artifacts={mockArtifacts} {...defaultHandlers} />);

      expect(screen.getByTestId('artifact-status-a1')).toHaveTextContent('complete');
    });

    it('should show writing status for in-progress artifacts', () => {
      render(<ArtifactPanel artifacts={mockArtifacts} {...defaultHandlers} />);

      expect(screen.getByTestId('artifact-status-a2')).toHaveTextContent('Writing');
    });

    it('should show pending status for not-yet-created artifacts', () => {
      render(<ArtifactPanel artifacts={mockArtifacts} {...defaultHandlers} />);

      expect(screen.getByTestId('artifact-status-a3')).toHaveTextContent('pending');
    });
  });

  describe('TC-ARTIFACT-003: Preview expansion', () => {
    it('should show preview when toggle is clicked', () => {
      render(<ArtifactPanel artifacts={mockArtifacts} {...defaultHandlers} />);

      const toggleButton = screen.getByTestId('toggle-preview-a1');
      fireEvent.click(toggleButton);

      expect(screen.getByTestId('preview-a1')).toBeInTheDocument();
      expect(screen.getByText(/User authentication/)).toBeInTheDocument();
    });

    it('should collapse preview when clicked again', () => {
      render(<ArtifactPanel artifacts={mockArtifacts} {...defaultHandlers} />);

      const toggleButton = screen.getByTestId('toggle-preview-a1');
      fireEvent.click(toggleButton); // Open
      fireEvent.click(toggleButton); // Close

      expect(screen.queryByTestId('preview-a1')).not.toBeInTheDocument();
    });
  });

  describe('TC-ARTIFACT-004: Action buttons', () => {
    it('should call onView when view button clicked', () => {
      const onView = vi.fn();

      render(<ArtifactPanel artifacts={mockArtifacts} {...defaultHandlers} onView={onView} />);

      fireEvent.click(screen.getByTestId('view-a1'));

      expect(onView).toHaveBeenCalledWith('a1');
    });

    it('should call onEdit when edit button clicked', () => {
      const onEdit = vi.fn();

      render(<ArtifactPanel artifacts={mockArtifacts} {...defaultHandlers} onEdit={onEdit} />);

      fireEvent.click(screen.getByTestId('edit-a1'));

      expect(onEdit).toHaveBeenCalledWith('a1');
    });

    it('should call onDownload when download button clicked', () => {
      const onDownload = vi.fn();

      render(<ArtifactPanel artifacts={mockArtifacts} {...defaultHandlers} onDownload={onDownload} />);

      fireEvent.click(screen.getByTestId('download-a1'));

      expect(onDownload).toHaveBeenCalledWith('a1');
    });

    it('should call onViewHistory when history button clicked', () => {
      const onViewHistory = vi.fn();

      render(<ArtifactPanel artifacts={mockArtifacts} {...defaultHandlers} onViewHistory={onViewHistory} />);

      fireEvent.click(screen.getByTestId('history-a1'));

      expect(onViewHistory).toHaveBeenCalledWith('a1');
    });

    it('should not show history for version 1 artifacts', () => {
      render(<ArtifactPanel artifacts={mockArtifacts} {...defaultHandlers} />);

      expect(screen.queryByTestId('history-a2')).not.toBeInTheDocument();
    });
  });

  describe('TC-ARTIFACT-005: Pending artifact display', () => {
    it('should show expected message for pending artifacts', () => {
      render(<ArtifactPanel artifacts={mockArtifacts} {...defaultHandlers} />);

      expect(screen.getByText(/Not yet created/)).toBeInTheDocument();
    });

    it('should not show action buttons for pending artifacts', () => {
      render(<ArtifactPanel artifacts={mockArtifacts} {...defaultHandlers} />);

      expect(screen.queryByTestId('view-a3')).not.toBeInTheDocument();
      expect(screen.queryByTestId('edit-a3')).not.toBeInTheDocument();
      expect(screen.queryByTestId('download-a3')).not.toBeInTheDocument();
    });
  });

  describe('TC-ARTIFACT-006: Writing artifact display', () => {
    it('should show View Live button for writing artifacts', () => {
      render(<ArtifactPanel artifacts={mockArtifacts} {...defaultHandlers} />);

      expect(screen.getByTestId('view-live-a2')).toBeInTheDocument();
    });
  });

  describe('TC-ARTIFACT-007: File size display', () => {
    it('should display file size in KB format', () => {
      render(<ArtifactPanel artifacts={mockArtifacts} {...defaultHandlers} />);

      expect(screen.getByText('2.4 KB')).toBeInTheDocument();
      expect(screen.getByText('5.0 KB')).toBeInTheDocument();
    });
  });

  describe('TC-ARTIFACT-008: Empty state', () => {
    it('should show empty message when no artifacts', () => {
      render(<ArtifactPanel artifacts={[]} {...defaultHandlers} />);

      expect(screen.getByTestId('artifact-panel-empty')).toBeInTheDocument();
      expect(screen.getByText(/No artifacts/)).toBeInTheDocument();
    });
  });

  describe('TC-ARTIFACT-009: Access type badges', () => {
    it('should display access type badges when provided', () => {
      const artifactsWithAccess: Artifact[] = [
        { ...mockArtifacts[0], accessType: 'read' },
        { ...mockArtifacts[1], accessType: 'write' },
      ];

      render(<ArtifactPanel artifacts={artifactsWithAccess} {...defaultHandlers} />);

      expect(screen.getByText(/read/)).toBeInTheDocument();
      expect(screen.getByText(/write/)).toBeInTheDocument();
    });
  });
});
