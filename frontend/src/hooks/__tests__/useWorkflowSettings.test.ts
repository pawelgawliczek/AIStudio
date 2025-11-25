import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowSettings } from '../useWorkflowSettings';
import { DEFAULT_SETTINGS } from '../../types/workflow-tracking';

describe('useWorkflowSettings', () => {
  const STORAGE_KEY = 'workflow-status-bar-settings';

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns default settings when no saved settings exist', () => {
    const { result } = renderHook(() => useWorkflowSettings());

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('loads saved settings from localStorage', () => {
    const savedSettings = {
      ...DEFAULT_SETTINGS,
      maxVisibleRuns: 3,
      viewMode: 'detailed' as const,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSettings));

    const { result } = renderHook(() => useWorkflowSettings());

    expect(result.current.settings).toEqual(savedSettings);
  });

  it('handles corrupted localStorage data gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid json');

    const { result } = renderHook(() => useWorkflowSettings());

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('updates settings and persists to localStorage', () => {
    const { result } = renderHook(() => useWorkflowSettings());

    act(() => {
      result.current.updateSettings({ maxVisibleRuns: 7 });
    });

    expect(result.current.settings.maxVisibleRuns).toBe(7);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(stored.maxVisibleRuns).toBe(7);
  });

  it('merges partial updates with existing settings', () => {
    const { result } = renderHook(() => useWorkflowSettings());

    act(() => {
      result.current.updateSettings({ maxVisibleRuns: 8 });
    });

    expect(result.current.settings).toEqual({
      ...DEFAULT_SETTINGS,
      maxVisibleRuns: 8,
    });

    act(() => {
      result.current.updateSettings({ viewMode: 'detailed' });
    });

    expect(result.current.settings).toEqual({
      ...DEFAULT_SETTINGS,
      maxVisibleRuns: 8,
      viewMode: 'detailed',
    });
  });

  it('toggles autoHide setting', () => {
    const { result } = renderHook(() => useWorkflowSettings());

    expect(result.current.settings.autoHide).toBe(false);

    act(() => {
      result.current.toggleAutoHide();
    });

    expect(result.current.settings.autoHide).toBe(true);

    act(() => {
      result.current.toggleAutoHide();
    });

    expect(result.current.settings.autoHide).toBe(false);
  });

  it('toggles animations setting', () => {
    const { result } = renderHook(() => useWorkflowSettings());

    expect(result.current.settings.animationsEnabled).toBe(true);

    act(() => {
      result.current.toggleAnimations();
    });

    expect(result.current.settings.animationsEnabled).toBe(false);

    act(() => {
      result.current.toggleAnimations();
    });

    expect(result.current.settings.animationsEnabled).toBe(true);
  });

  it('sets view mode', () => {
    const { result } = renderHook(() => useWorkflowSettings());

    act(() => {
      result.current.setViewMode('detailed');
    });

    expect(result.current.settings.viewMode).toBe('detailed');

    act(() => {
      result.current.setViewMode('compact');
    });

    expect(result.current.settings.viewMode).toBe('compact');
  });

  it('sets max visible runs', () => {
    const { result } = renderHook(() => useWorkflowSettings());

    act(() => {
      result.current.setMaxVisibleRuns(8);
    });

    expect(result.current.settings.maxVisibleRuns).toBe(8);
  });

  it('validates max visible runs range (3-10)', () => {
    const { result } = renderHook(() => useWorkflowSettings());

    // Below minimum
    act(() => {
      result.current.setMaxVisibleRuns(2);
    });
    expect(result.current.settings.maxVisibleRuns).toBe(3);

    // Above maximum
    act(() => {
      result.current.setMaxVisibleRuns(11);
    });
    expect(result.current.settings.maxVisibleRuns).toBe(10);

    // Valid range
    act(() => {
      result.current.setMaxVisibleRuns(7);
    });
    expect(result.current.settings.maxVisibleRuns).toBe(7);
  });

  it('expands a run', () => {
    const { result } = renderHook(() => useWorkflowSettings());

    act(() => {
      result.current.expandRun('run-1');
    });

    expect(result.current.settings.expandedRuns).toContain('run-1');
  });

  it('collapses a run', () => {
    const { result } = renderHook(() => useWorkflowSettings());

    act(() => {
      result.current.expandRun('run-1');
      result.current.expandRun('run-2');
    });

    expect(result.current.settings.expandedRuns).toEqual(['run-1', 'run-2']);

    act(() => {
      result.current.collapseRun('run-1');
    });

    expect(result.current.settings.expandedRuns).toEqual(['run-2']);
  });

  it('toggles run expansion', () => {
    const { result } = renderHook(() => useWorkflowSettings());

    act(() => {
      result.current.toggleRunExpansion('run-1');
    });

    expect(result.current.settings.expandedRuns).toContain('run-1');

    act(() => {
      result.current.toggleRunExpansion('run-1');
    });

    expect(result.current.settings.expandedRuns).not.toContain('run-1');
  });

  it('checks if run is expanded', () => {
    const { result } = renderHook(() => useWorkflowSettings());

    expect(result.current.isRunExpanded('run-1')).toBe(false);

    act(() => {
      result.current.expandRun('run-1');
    });

    expect(result.current.isRunExpanded('run-1')).toBe(true);
  });

  it('collapses all runs', () => {
    const { result } = renderHook(() => useWorkflowSettings());

    act(() => {
      result.current.expandRun('run-1');
      result.current.expandRun('run-2');
      result.current.expandRun('run-3');
    });

    expect(result.current.settings.expandedRuns).toHaveLength(3);

    act(() => {
      result.current.collapseAll();
    });

    expect(result.current.settings.expandedRuns).toHaveLength(0);
  });

  it('resets settings to defaults', () => {
    const { result } = renderHook(() => useWorkflowSettings());

    act(() => {
      result.current.updateSettings({
        maxVisibleRuns: 8,
        viewMode: 'detailed',
        autoHide: true,
      });
    });

    expect(result.current.settings).not.toEqual(DEFAULT_SETTINGS);

    act(() => {
      result.current.resetSettings();
    });

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);

    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).toBe(null);
  });

  it('persists expanded runs across page refresh', () => {
    const { result: result1 } = renderHook(() => useWorkflowSettings());

    act(() => {
      result1.current.expandRun('run-1');
      result1.current.expandRun('run-2');
    });

    // Simulate page refresh by creating new hook instance
    const { result: result2 } = renderHook(() => useWorkflowSettings());

    expect(result2.current.settings.expandedRuns).toEqual(['run-1', 'run-2']);
  });

  it('removes non-existent runs from expanded list', () => {
    const { result } = renderHook(() => useWorkflowSettings());

    act(() => {
      result.current.expandRun('run-1');
      result.current.expandRun('run-2');
      result.current.expandRun('run-3');
    });

    act(() => {
      result.current.cleanupExpandedRuns(['run-1', 'run-3']);
    });

    expect(result.current.settings.expandedRuns).toEqual(['run-1', 'run-3']);
  });
});
