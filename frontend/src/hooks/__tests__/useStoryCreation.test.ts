/**
 * Tests for useStoryCreation hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStoryCreation } from '../useStoryCreation';
import { MemoryRouter } from 'react-router-dom';

const wrapper = ({ children }: any) => <MemoryRouter>{children}</MemoryRouter>;

describe('useStoryCreation', () => {
  it('should initialize with modal closed', () => {
    const { result } = renderHook(() => useStoryCreation('test-project-id'), { wrapper });

    expect(result.current.isStoryModalOpen).toBe(false);
    expect(result.current.storyTitle).toBe('');
  });

  it('should open modal with file data', () => {
    const { result } = renderHook(() => useStoryCreation('test-project-id'), { wrapper });

    const mockFile = {
      filePath: 'src/test.ts',
      riskScore: 75,
      complexity: 15,
      churnCount: 5,
      coverage: 30,
      loc: 200,
      lastModified: new Date(),
      criticalIssues: 2,
    };

    act(() => {
      result.current.createStoryForFile(mockFile);
    });

    expect(result.current.isStoryModalOpen).toBe(true);
    expect(result.current.storyTitle).toContain('test.ts');
  });
});
