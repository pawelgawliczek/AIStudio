/**
 * Tests for useFileTree hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFileTree } from '../useFileTree';
import axios from '../../lib/axios';

vi.mock('../../lib/axios');

const mockFileDetail = {
  filePath: 'src/components/Test.tsx',
  riskScore: 75,
  complexity: 15,
  churnCount: 8,
  coverage: 60,
  loc: 300,
  lastModified: new Date().toISOString(),
  maintainability: 65,
  codeSmells: [
    { type: 'complexity', severity: 'high', message: 'High complexity function' },
  ],
  functions: [
    { name: 'testFunc', complexity: 10, loc: 50 },
  ],
};

describe('useFileTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useFileTree('test-project-id'));

    expect(result.current.expandedFolders.size).toBe(0);
    expect(result.current.selectedFile).toBeNull();
    expect(result.current.drillDownLevel).toBe('project');
    expect(result.current.loadingDetail).toBe(false);
  });

  it('should provide all required functions', () => {
    const { result } = renderHook(() => useFileTree('test-project-id'));

    expect(typeof result.current.toggleFolder).toBe('function');
    expect(typeof result.current.selectFile).toBe('function');
    expect(typeof result.current.backToProject).toBe('function');
  });

  it('should toggle folder expansion', () => {
    const { result } = renderHook(() => useFileTree('test-project-id'));

    act(() => {
      result.current.toggleFolder('src');
    });

    expect(result.current.expandedFolders.has('src')).toBe(true);

    act(() => {
      result.current.toggleFolder('src');
    });

    expect(result.current.expandedFolders.has('src')).toBe(false);
  });

  it('should expand multiple folders independently', () => {
    const { result } = renderHook(() => useFileTree('test-project-id'));

    act(() => {
      result.current.toggleFolder('src');
      result.current.toggleFolder('components');
      result.current.toggleFolder('utils');
    });

    expect(result.current.expandedFolders.has('src')).toBe(true);
    expect(result.current.expandedFolders.has('components')).toBe(true);
    expect(result.current.expandedFolders.has('utils')).toBe(true);
    expect(result.current.expandedFolders.size).toBe(3);
  });

  it('should select file and fetch details successfully', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: mockFileDetail });

    const { result } = renderHook(() => useFileTree('test-project-id'));

    await act(async () => {
      await result.current.selectFile('src/components/Test.tsx');
    });

    await waitFor(() => {
      expect(result.current.loadingDetail).toBe(false);
    });

    expect(result.current.selectedFile).toEqual(mockFileDetail);
    expect(result.current.drillDownLevel).toBe('file');
    expect(vi.mocked(axios.get)).toHaveBeenCalledWith(
      '/code-metrics/project/test-project-id/file/src%2Fcomponents%2FTest.tsx'
    );
  });

  it('should show loading state when fetching file details', async () => {
    vi.mocked(axios.get).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ data: mockFileDetail }), 100))
    );

    const { result } = renderHook(() => useFileTree('test-project-id'));

    let loadingStateBeforeFetch = false;

    await act(async () => {
      const promise = result.current.selectFile('src/components/Test.tsx');
      loadingStateBeforeFetch = result.current.loadingDetail;
      await promise;
    });

    expect(loadingStateBeforeFetch).toBe(true);
    expect(result.current.loadingDetail).toBe(false);
  });

  it('should handle file detail fetch error gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(axios.get).mockRejectedValue(new Error('File not found'));

    const { result } = renderHook(() => useFileTree('test-project-id'));

    await act(async () => {
      await result.current.selectFile('nonexistent.ts');
    });

    await waitFor(() => {
      expect(result.current.loadingDetail).toBe(false);
    });

    expect(result.current.selectedFile).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('should not fetch file details when projectId is undefined', async () => {
    const { result } = renderHook(() => useFileTree(undefined));

    await act(async () => {
      await result.current.selectFile('src/test.ts');
    });

    expect(vi.mocked(axios.get)).not.toHaveBeenCalled();
    expect(result.current.selectedFile).toBeNull();
  });

  it('should properly encode file paths with special characters', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: mockFileDetail });

    const { result } = renderHook(() => useFileTree('test-project-id'));

    await act(async () => {
      await result.current.selectFile('src/components/Test Component.tsx');
    });

    expect(vi.mocked(axios.get)).toHaveBeenCalledWith(
      expect.stringContaining('Test%20Component.tsx')
    );
  });

  it('should return to project view and clear selected file', () => {
    const { result } = renderHook(() => useFileTree('test-project-id'));

    // Simulate having a selected file
    act(() => {
      result.current.selectFile('src/test.ts');
    });

    act(() => {
      result.current.backToProject();
    });

    expect(result.current.drillDownLevel).toBe('project');
    expect(result.current.selectedFile).toBeNull();
  });

  it('should handle multiple rapid toggles correctly', () => {
    const { result } = renderHook(() => useFileTree('test-project-id'));

    act(() => {
      result.current.toggleFolder('src');
      result.current.toggleFolder('src');
      result.current.toggleFolder('src');
      result.current.toggleFolder('src');
    });

    // Should end up expanded (4 toggles = 2 cycles)
    expect(result.current.expandedFolders.has('src')).toBe(false);
  });

  it('should maintain separate state for different folder paths', () => {
    const { result } = renderHook(() => useFileTree('test-project-id'));

    act(() => {
      result.current.toggleFolder('src/components');
      result.current.toggleFolder('src/utils');
    });

    expect(result.current.expandedFolders.has('src/components')).toBe(true);
    expect(result.current.expandedFolders.has('src/utils')).toBe(true);

    act(() => {
      result.current.toggleFolder('src/components');
    });

    expect(result.current.expandedFolders.has('src/components')).toBe(false);
    expect(result.current.expandedFolders.has('src/utils')).toBe(true);
  });
});
