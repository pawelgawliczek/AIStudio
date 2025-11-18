/**
 * Tests for useAnalysisPolling hook
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnalysisPolling } from '../useAnalysisPolling';

describe('useAnalysisPolling', () => {
  it('should initialize with correct default state', () => {
    const mockOnComplete = vi.fn();
    const { result } = renderHook(() =>
      useAnalysisPolling('test-project-id', mockOnComplete)
    );

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.analysisStatus).toBeNull();
  });

  it('should provide startAnalysis function', () => {
    const mockOnComplete = vi.fn();
    const { result } = renderHook(() =>
      useAnalysisPolling('test-project-id', mockOnComplete)
    );

    expect(typeof result.current.startAnalysis).toBe('function');
  });
});
