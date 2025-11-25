import { useState, useEffect, useCallback } from 'react';
import {
  StatusBarSettings,
  DEFAULT_SETTINGS,
  StatusBarViewMode,
} from '../types/workflow-tracking';

const STORAGE_KEY = 'workflow-status-bar-settings';

/**
 * Hook for managing workflow status bar settings with localStorage persistence
 */
export function useWorkflowSettings() {
  const [settings, setSettings] = useState<StatusBarSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
    }
    return DEFAULT_SETTINGS;
  });

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
    }
  }, [settings]);

  const updateSettings = useCallback((partial: Partial<StatusBarSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const toggleAutoHide = useCallback(() => {
    setSettings((prev) => ({ ...prev, autoHide: !prev.autoHide }));
  }, []);

  const toggleAnimations = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      animationsEnabled: !prev.animationsEnabled,
    }));
  }, []);

  const setViewMode = useCallback((viewMode: StatusBarViewMode) => {
    setSettings((prev) => ({ ...prev, viewMode }));
  }, []);

  const setMaxVisibleRuns = useCallback((count: number) => {
    // Validate range 3-10
    const validated = Math.max(3, Math.min(10, count));
    setSettings((prev) => ({ ...prev, maxVisibleRuns: validated }));
  }, []);

  const expandRun = useCallback((runId: string) => {
    setSettings((prev) => ({
      ...prev,
      expandedRuns: prev.expandedRuns.includes(runId)
        ? prev.expandedRuns
        : [...prev.expandedRuns, runId],
    }));
  }, []);

  const collapseRun = useCallback((runId: string) => {
    setSettings((prev) => ({
      ...prev,
      expandedRuns: prev.expandedRuns.filter((id) => id !== runId),
    }));
  }, []);

  const toggleRunExpansion = useCallback((runId: string) => {
    setSettings((prev) => ({
      ...prev,
      expandedRuns: prev.expandedRuns.includes(runId)
        ? prev.expandedRuns.filter((id) => id !== runId)
        : [...prev.expandedRuns, runId],
    }));
  }, []);

  const isRunExpanded = useCallback(
    (runId: string) => settings.expandedRuns.includes(runId),
    [settings.expandedRuns]
  );

  const collapseAll = useCallback(() => {
    setSettings((prev) => ({ ...prev, expandedRuns: [] }));
  }, []);

  const cleanupExpandedRuns = useCallback((activeRunIds: string[]) => {
    setSettings((prev) => ({
      ...prev,
      expandedRuns: prev.expandedRuns.filter((id) => activeRunIds.includes(id)),
    }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to remove settings from localStorage:', error);
    }
  }, []);

  return {
    settings,
    updateSettings,
    toggleAutoHide,
    toggleAnimations,
    setViewMode,
    setMaxVisibleRuns,
    expandRun,
    collapseRun,
    toggleRunExpansion,
    isRunExpanded,
    collapseAll,
    cleanupExpandedRuns,
    resetSettings,
  };
}
