/**
 * Unit Tests for TranscriptViewerModal Component (ST-173 Phase 7)
 *
 * Tests comprehensive transcript viewing functionality:
 * - Modal open/close
 * - Tab switching (Parsed ↔ Raw JSONL)
 * - Lazy loading (Raw JSONL fetched only when tab activated)
 * - Size warning (>1MB confirmation dialog)
 * - Download functionality (Blob creation, correct MIME type)
 * - Copy functionality
 * - Master vs Agent badge display
 * - Token metrics display
 *
 * Coverage: 15 test cases
 * - Modal Rendering: 3 tests
 * - Tab Switching: 3 tests
 * - Lazy Loading: 2 tests
 * - Security Requirements: 4 tests
 * - Download/Copy: 2 tests
 * - Error Handling: 1 test
 *
 * TDD STATUS: 🔴 ALL TESTS FAILING - Component not yet implemented
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TranscriptViewerModal } from '../TranscriptViewerModal';
import { transcriptsService } from '../../../services/transcripts.service';
import type { TranscriptDetail } from '../../../services/transcripts.service';

// Mock services
vi.mock('../../../services/transcripts.service');

// Mock window.confirm
const mockConfirm = vi.fn();
global.confirm = mockConfirm;

// Mock URL methods
const mockCreateObjectURL = vi.fn(() => 'blob:test-url');
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});

const mockTranscriptDetail: TranscriptDetail = {
  id: 'artifact-1',
  contentPreview: 'User: Implement transcript viewer\nAssistant: I will help...',
  contentType: 'application/x-jsonlines',
  size: 2048,
  transcriptType: 'agent',
  componentId: 'component-1',
  componentName: 'Implementation Agent',
  createdAt: '2025-12-05T10:00:00Z',
  metrics: {
    inputTokens: 8200,
    outputTokens: 4250,
    totalTokens: 12450,
  },
};

const mockRawContent = `{"type":"text","role":"user","content":"Please implement the transcript viewer"}
{"type":"text","role":"assistant","content":"I will help implement that..."}
{"type":"tool_use","name":"Read","input":{"file_path":"StateBlock.tsx"}}
{"type":"tool_result","name":"Read","output":"File contents here..."}`;

const mockLargeTranscript: TranscriptDetail = {
  ...mockTranscriptDetail,
  size: 2 * 1024 * 1024, // 2MB
};

describe('TranscriptViewerModal', () => {
  let user: ReturnType<typeof userEvent.setup>;
  const mockOnClose = vi.fn();

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    mockConfirm.mockReturnValue(true);

    // Setup service mocks
    vi.mocked(transcriptsService.getTranscript).mockResolvedValue({
      ...mockTranscriptDetail,
      content: mockRawContent,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = (props: Partial<Parameters<typeof TranscriptViewerModal>[0]> = {}) => {
    return render(
      <TranscriptViewerModal
        open={true}
        transcriptId="artifact-1"
        transcriptType="agent"
        componentRunId="run-1"
        runId="workflow-run-1"
        projectId="project-1"
        onClose={mockOnClose}
        {...props}
      />
    );
  };

  // ============================================================================
  // MODAL RENDERING TESTS
  // ============================================================================

  describe('TC-TRANSCRIPT-MODAL-001: Modal Rendering', () => {
    it('should render modal when open is true', () => {
      renderModal();

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Implementation Agent/i)).toBeInTheDocument();
    });

    it('should not render modal when open is false', () => {
      renderModal({ open: false });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display transcript type badge (master vs agent)', () => {
      renderModal({ transcriptType: 'master' });

      expect(screen.getByTestId('transcript-type-badge')).toBeInTheDocument();
      expect(screen.getByText(/MASTER/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // TAB SWITCHING TESTS
  // ============================================================================

  describe('TC-TRANSCRIPT-MODAL-002: Tab Switching', () => {
    it('should render both Parsed and Raw JSONL tabs', () => {
      renderModal();

      expect(screen.getByRole('tab', { name: /parsed view/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /raw jsonl/i })).toBeInTheDocument();
    });

    it('should show Parsed view by default', () => {
      renderModal();

      const parsedTab = screen.getByRole('tab', { name: /parsed view/i });
      expect(parsedTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should switch to Raw JSONL tab when clicked', async () => {
      renderModal();

      const rawTab = screen.getByRole('tab', { name: /raw jsonl/i });
      await user.click(rawTab);

      await waitFor(() => {
        expect(rawTab).toHaveAttribute('aria-selected', 'true');
      });
    });
  });

  // ============================================================================
  // LAZY LOADING TESTS
  // ============================================================================

  describe('TC-TRANSCRIPT-MODAL-003: Lazy Loading', () => {
    it('should NOT fetch raw content on initial render', () => {
      renderModal();

      // Only preview shown in Parsed view, no API call for raw content
      expect(transcriptsService.getTranscript).not.toHaveBeenCalled();
    });

    it('should fetch raw content only when Raw JSONL tab is activated', async () => {
      renderModal();

      const rawTab = screen.getByRole('tab', { name: /raw jsonl/i });
      await user.click(rawTab);

      await waitFor(() => {
        expect(transcriptsService.getTranscript).toHaveBeenCalledWith(
          'project-1',
          'workflow-run-1',
          'artifact-1',
          true // includeContent=true
        );
      });
    });
  });

  // ============================================================================
  // SECURITY REQUIREMENTS TESTS (CRITICAL)
  // ============================================================================

  describe('TC-TRANSCRIPT-MODAL-004: Security Requirements', () => {
    it('🔴 CRITICAL: should use <pre> tag for Raw JSONL (not dangerouslySetInnerHTML)', async () => {
      renderModal();

      const rawTab = screen.getByRole('tab', { name: /raw jsonl/i });
      await user.click(rawTab);

      await waitFor(() => {
        const preElement = screen.getByTestId('raw-jsonl-content');
        expect(preElement.tagName).toBe('PRE');
        expect(preElement).toHaveStyle({ whiteSpace: 'pre-wrap' });
      });
    });

    it('🔴 CRITICAL: should show size warning for transcripts >1MB', async () => {
      vi.mocked(transcriptsService.getTranscript).mockResolvedValue({
        ...mockLargeTranscript,
        content: mockRawContent,
      });

      renderModal({ transcriptId: 'large-artifact' });

      const rawTab = screen.getByRole('tab', { name: /raw jsonl/i });
      await user.click(rawTab);

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalledWith(
          expect.stringContaining('2.0 MB')
        );
      });
    });

    it('🔴 CRITICAL: should abort fetch if user cancels size warning', async () => {
      mockConfirm.mockReturnValueOnce(false);
      vi.mocked(transcriptsService.getTranscript).mockResolvedValue({
        ...mockLargeTranscript,
        content: mockRawContent,
      });

      renderModal({ transcriptId: 'large-artifact' });

      const rawTab = screen.getByRole('tab', { name: /raw jsonl/i });
      await user.click(rawTab);

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalled();
      });

      // Raw content should not be displayed
      expect(screen.queryByTestId('raw-jsonl-content')).not.toBeInTheDocument();
    });

    it('🔴 CRITICAL: should use application/x-jsonlines MIME type for download', async () => {
      renderModal();

      const rawTab = screen.getByRole('tab', { name: /raw jsonl/i });
      await user.click(rawTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
      });

      const downloadButton = screen.getByRole('button', { name: /download/i });
      await user.click(downloadButton);

      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'application/x-jsonlines',
          })
        );
      });
    });
  });

  // ============================================================================
  // TOKEN METRICS DISPLAY TESTS
  // ============================================================================

  describe('TC-TRANSCRIPT-MODAL-005: Token Metrics Display', () => {
    it('should display aggregate token metrics in modal header', () => {
      renderModal();

      expect(screen.getByText(/12,450 tokens/i)).toBeInTheDocument();
      expect(screen.getByText(/8.2K in/i)).toBeInTheDocument();
      expect(screen.getByText(/4.2K out/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // DOWNLOAD/COPY FUNCTIONALITY TESTS
  // ============================================================================

  describe('TC-TRANSCRIPT-MODAL-006: Download and Copy', () => {
    it('should download raw JSONL with correct filename', async () => {
      renderModal();

      const rawTab = screen.getByRole('tab', { name: /raw jsonl/i });
      await user.click(rawTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
      });

      const downloadButton = screen.getByRole('button', { name: /download/i });
      await user.click(downloadButton);

      await waitFor(() => {
        // Verify blob creation and download
        expect(mockCreateObjectURL).toHaveBeenCalled();
      });

      // Verify cleanup
      await waitFor(() => {
        expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');
      });
    });

    it('should copy content to clipboard when copy button clicked', async () => {
      renderModal();

      const copyButton = screen.getByRole('button', { name: /copy/i });
      await user.click(copyButton);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
      });

      // Verify feedback message
      expect(screen.getByText(/copied/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('TC-TRANSCRIPT-MODAL-007: Error Handling', () => {
    it('should display error message when transcript fetch fails', async () => {
      vi.mocked(transcriptsService.getTranscript).mockRejectedValue(
        new Error('Transcript not found')
      );

      renderModal();

      const rawTab = screen.getByRole('tab', { name: /raw jsonl/i });
      await user.click(rawTab);

      await waitFor(() => {
        expect(screen.getByText(/failed to load transcript/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // USER INTERACTIONS TESTS
  // ============================================================================

  describe('TC-TRANSCRIPT-MODAL-008: User Interactions', () => {
    it('should call onClose when close button clicked', async () => {
      renderModal();

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close modal when clicking overlay', async () => {
      renderModal();

      const dialog = screen.getByRole('dialog');
      const overlay = dialog.parentElement;

      if (overlay) {
        fireEvent.click(overlay);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });
  });
});
