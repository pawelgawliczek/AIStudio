/**
 * Tests for useFileTree hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileTree } from '../useFileTree';

describe('useFileTree', () => {
  it('should initialize with empty expanded folders', () => {
    const { result } = renderHook(() => useFileTree('test-project-id'));

    expect(result.current.expandedFolders.size).toBe(0);
    expect(result.current.selectedFile).toBeNull();
    expect(result.current.drillDownLevel).toBe('project');
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
});
