/**
 * Tests for useCodeQualityMetrics hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCodeQualityMetrics } from '../useCodeQualityMetrics';
import axios from '../../lib/axios';

vi.mock('../../lib/axios');

describe('useCodeQualityMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() =>
      useCodeQualityMetrics('test-project-id', {
        severityFilter: 'all',
        typeFilter: 'all',
        showOnlyHighRisk: false,
        timeRange: 30,
      })
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.projectMetrics).toBeNull();
  });

  it('should handle fetch errors gracefully', async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useCodeQualityMetrics('test-project-id', {
        severityFilter: 'all',
        typeFilter: 'all',
        showOnlyHighRisk: false,
        timeRange: 30,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });
});
