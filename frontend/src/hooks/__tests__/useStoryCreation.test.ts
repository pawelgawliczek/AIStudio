/**
 * Tests for useStoryCreation hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useStoryCreation } from '../useStoryCreation';
import { MemoryRouter } from 'react-router-dom';
import toast from 'react-hot-toast';
import { storiesService } from '../../services/stories.service';

vi.mock('react-hot-toast');
vi.mock('../../services/stories.service');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const wrapper = ({ children }: any) => <MemoryRouter>{children}</MemoryRouter>;

const mockFile = {
  filePath: 'src/components/ComplexFile.tsx',
  riskScore: 85,
  complexity: 25,
  churnCount: 12,
  coverage: 25,
  loc: 500,
  lastModified: new Date(),
  criticalIssues: 5,
};

const mockIssue = {
  type: 'Code Smell',
  severity: 'critical' as const,
  count: 15,
  filesAffected: 8,
  sampleFiles: ['file1.ts', 'file2.ts'],
};

const mockFolder = {
  name: 'components',
  path: 'src/components',
  type: 'folder' as const,
  children: [],
  metrics: {
    healthScore: 60,
    fileCount: 25,
    totalLoc: 5000,
    avgComplexity: 12,
    avgCoverage: 55,
    avgMaintainability: 65,
  },
};

describe('useStoryCreation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useStoryCreation('test-project-id'), { wrapper });

    expect(result.current.isStoryModalOpen).toBe(false);
    expect(result.current.storyTitle).toBe('');
    expect(result.current.storyDescription).toBe('');
    expect(result.current.storyContext).toBeNull();
    expect(result.current.creatingStory).toBe(false);
  });

  it('should provide all required functions', () => {
    const { result } = renderHook(() => useStoryCreation('test-project-id'), { wrapper });

    expect(typeof result.current.createStoryForFile).toBe('function');
    expect(typeof result.current.createStoryForIssue).toBe('function');
    expect(typeof result.current.createStoryForFolder).toBe('function');
    expect(typeof result.current.saveStory).toBe('function');
    expect(typeof result.current.closeModal).toBe('function');
    expect(typeof result.current.setStoryTitle).toBe('function');
    expect(typeof result.current.setStoryDescription).toBe('function');
  });

  describe('createStoryForFile', () => {
    it('should open modal with file-specific content', () => {
      const { result } = renderHook(() => useStoryCreation('test-project-id'), { wrapper });

      act(() => {
        result.current.createStoryForFile(mockFile);
      });

      expect(result.current.isStoryModalOpen).toBe(true);
      expect(result.current.storyTitle).toContain('ComplexFile.tsx');
      expect(result.current.storyDescription).toContain('Risk Score');
      expect(result.current.storyDescription).toContain('85');
      expect(result.current.storyContext).toEqual({ type: 'file', data: mockFile });
    });

    it('should generate appropriate refactoring goals for high risk file', () => {
      const { result } = renderHook(() => useStoryCreation('test-project-id'), { wrapper });

      act(() => {
        result.current.createStoryForFile(mockFile);
      });

      expect(result.current.storyDescription).toContain('Reduce complexity');
      expect(result.current.storyDescription).toContain('Add tests');
      expect(result.current.storyDescription).toContain('Fix 5 critical issue');
    });

    it('should handle low coverage files with appropriate targets', () => {
      const lowCoverageFile = { ...mockFile, coverage: 40 };
      const { result } = renderHook(() => useStoryCreation('test-project-id'), { wrapper });

      act(() => {
        result.current.createStoryForFile(lowCoverageFile);
      });

      expect(result.current.storyDescription).toContain('70%+ coverage');
    });
  });

  describe('createStoryForIssue', () => {
    it('should open modal with issue-specific content', () => {
      const { result } = renderHook(() => useStoryCreation('test-project-id'), { wrapper });

      act(() => {
        result.current.createStoryForIssue(mockIssue);
      });

      expect(result.current.isStoryModalOpen).toBe(true);
      expect(result.current.storyTitle).toContain('critical');
      expect(result.current.storyTitle).toContain('code smell');
      expect(result.current.storyDescription).toContain('CRITICAL');
      expect(result.current.storyDescription).toContain('15 occurrence');
      expect(result.current.storyContext).toEqual({ type: 'issue', data: mockIssue });
    });

    it('should include sample files when available', () => {
      const { result } = renderHook(() => useStoryCreation('test-project-id'), { wrapper });

      act(() => {
        result.current.createStoryForIssue(mockIssue);
      });

      expect(result.current.storyDescription).toContain('Sample Files');
      expect(result.current.storyDescription).toContain('file1.ts');
      expect(result.current.storyDescription).toContain('file2.ts');
    });
  });

  describe('createStoryForFolder', () => {
    it('should open modal with folder-specific content', () => {
      const { result } = renderHook(() => useStoryCreation('test-project-id'), { wrapper });

      act(() => {
        result.current.createStoryForFolder(mockFolder);
      });

      expect(result.current.isStoryModalOpen).toBe(true);
      expect(result.current.storyTitle).toContain('src/components');
      expect(result.current.storyDescription).toContain('Folder Analysis');
      expect(result.current.storyDescription).toContain('25');
      expect(result.current.storyContext).toEqual({ type: 'folder', data: mockFolder });
    });

    it('should handle file nodes differently from folder nodes', () => {
      const fileNode = { ...mockFolder, type: 'file' as const };
      const { result } = renderHook(() => useStoryCreation('test-project-id'), { wrapper });

      act(() => {
        result.current.createStoryForFolder(fileNode);
      });

      expect(result.current.storyTitle).toContain('Refactor:');
      expect(result.current.storyDescription).toContain('File Analysis');
    });
  });

  describe('saveStory', () => {
    it('should create story successfully and show success toast', async () => {
      vi.mocked(storiesService.create).mockResolvedValue({ id: 'story-123' } as any);
      const mockNavigate = vi.fn();
      vi.mocked(vi.importActual<any>('react-router-dom').then(m => m.useNavigate)).mockReturnValue(mockNavigate);

      const { result } = renderHook(() => useStoryCreation('test-project-id'), { wrapper });

      act(() => {
        result.current.createStoryForFile(mockFile);
        result.current.setStoryTitle('Test Story');
        result.current.setStoryDescription('Test description');
      });

      await act(async () => {
        await result.current.saveStory();
      });

      await waitFor(() => {
        expect(result.current.creatingStory).toBe(false);
      });

      expect(storiesService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'test-project-id',
          title: 'Test Story',
          description: 'Test description',
        })
      );
      expect(toast.success).toHaveBeenCalledWith('Story created successfully!');
      expect(result.current.isStoryModalOpen).toBe(false);
    });

    it('should show error toast when title is empty', async () => {
      const { result } = renderHook(() => useStoryCreation('test-project-id'), { wrapper });

      act(() => {
        result.current.createStoryForFile(mockFile);
        result.current.setStoryTitle('');
      });

      await act(async () => {
        await result.current.saveStory();
      });

      expect(toast.error).toHaveBeenCalledWith('Please enter a story title');
      expect(storiesService.create).not.toHaveBeenCalled();
    });

    it('should not save when projectId is undefined', async () => {
      const { result } = renderHook(() => useStoryCreation(undefined), { wrapper });

      act(() => {
        result.current.setStoryTitle('Test');
      });

      await act(async () => {
        await result.current.saveStory();
      });

      expect(storiesService.create).not.toHaveBeenCalled();
    });

    it('should handle API errors and show error toast', async () => {
      const errorMessage = 'Failed to create story';
      vi.mocked(storiesService.create).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useStoryCreation('test-project-id'), { wrapper });

      act(() => {
        result.current.createStoryForFile(mockFile);
        result.current.setStoryTitle('Test Story');
      });

      await act(async () => {
        await result.current.saveStory();
      });

      await waitFor(() => {
        expect(result.current.creatingStory).toBe(false);
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining(errorMessage)
      );
      expect(result.current.isStoryModalOpen).toBe(true); // Modal stays open on error
    });

    it('should set loading state during creation', async () => {
      vi.mocked(storiesService.create).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ id: 'story-123' } as any), 100))
      );

      const { result } = renderHook(() => useStoryCreation('test-project-id'), { wrapper });

      act(() => {
        result.current.createStoryForFile(mockFile);
        result.current.setStoryTitle('Test Story');
      });

      let creatingStateDuringCall = false;

      await act(async () => {
        const promise = result.current.saveStory();
        await new Promise(resolve => setTimeout(resolve, 10));
        creatingStateDuringCall = result.current.creatingStory;
        await promise;
      });

      expect(creatingStateDuringCall).toBe(true);
      expect(result.current.creatingStory).toBe(false);
    });
  });

  describe('closeModal', () => {
    it('should close modal and reset all state', () => {
      const { result } = renderHook(() => useStoryCreation('test-project-id'), { wrapper });

      act(() => {
        result.current.createStoryForFile(mockFile);
      });

      expect(result.current.isStoryModalOpen).toBe(true);

      act(() => {
        result.current.closeModal();
      });

      expect(result.current.isStoryModalOpen).toBe(false);
      expect(result.current.storyTitle).toBe('');
      expect(result.current.storyDescription).toBe('');
      expect(result.current.storyContext).toBeNull();
    });
  });

  describe('setters', () => {
    it('should update story title', () => {
      const { result } = renderHook(() => useStoryCreation('test-project-id'), { wrapper });

      act(() => {
        result.current.setStoryTitle('New Title');
      });

      expect(result.current.storyTitle).toBe('New Title');
    });

    it('should update story description', () => {
      const { result } = renderHook(() => useStoryCreation('test-project-id'), { wrapper });

      act(() => {
        result.current.setStoryDescription('New Description');
      });

      expect(result.current.storyDescription).toBe('New Description');
    });
  });
});
