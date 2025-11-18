/**
 * Custom hook for code analysis polling and status management
 * Handles analysis triggering, status polling, and notifications
 */

import { useState, useCallback, useRef } from 'react';
import axios from '../lib/axios';
import { AnalysisStatus } from '../types/codeQualityTypes';

interface UseAnalysisPollingReturn {
  analysisStatus: AnalysisStatus | null;
  isAnalyzing: boolean;
  analysisJobId: string | null;
  showAnalysisNotification: boolean;
  showAnalysisResultsModal: boolean;
  startAnalysis: () => Promise<void>;
  dismissNotification: () => void;
  closeResultsModal: () => void;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_DURATION_MS = 300000; // 5 minutes

export function useAnalysisPolling(
  projectId: string | undefined,
  onAnalysisComplete: () => Promise<void>
): UseAnalysisPollingReturn {
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
  const [showAnalysisNotification, setShowAnalysisNotification] = useState(false);
  const [showAnalysisResultsModal, setShowAnalysisResultsModal] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async (): Promise<boolean> => {
    if (!projectId) return true;

    try {
      const response = await axios.get(
        `/code-metrics/project/${projectId}/analysis-status`
      );
      setAnalysisStatus(response.data);

      if (response.data.status === 'completed') {
        setShowAnalysisNotification(true);
        setIsAnalyzing(false);
        await onAnalysisComplete();
        setShowAnalysisResultsModal(true);
        return true; // Stop polling
      } else if (response.data.status === 'failed') {
        setShowAnalysisNotification(true);
        setIsAnalyzing(false);
        return true; // Stop polling
      }
      return false; // Continue polling
    } catch (error: any) {
      return false; // Continue polling on error
    }
  }, [projectId, onAnalysisComplete]);

  const startAnalysis = useCallback(async () => {
    if (isAnalyzing || !projectId) return;

    setIsAnalyzing(true);
    setShowAnalysisNotification(false);
    clearTimers();

    try {
      const response = await axios.post(
        `/code-metrics/project/${projectId}/analyze`,
        {}
      );
      setAnalysisJobId(response.data.jobId);

      setAnalysisStatus({
        status: 'running',
        message: 'Code analysis started...',
      });

      // Start polling for status
      pollIntervalRef.current = setInterval(async () => {
        const shouldStop = await pollStatus();
        if (shouldStop) {
          clearTimers();
        }
      }, POLL_INTERVAL_MS);

      // Stop polling after max duration
      timeoutRef.current = setTimeout(() => {
        clearTimers();
        if (isAnalyzing) {
          setIsAnalyzing(false);
          setAnalysisStatus({
            status: 'failed',
            message: 'Analysis timeout - took longer than expected',
          });
        }
      }, MAX_POLL_DURATION_MS);
    } catch (error: any) {
      setIsAnalyzing(false);
      setAnalysisStatus({
        status: 'failed',
        message: error.response?.data?.message || 'Failed to start analysis',
      });
    }
  }, [isAnalyzing, projectId, pollStatus, clearTimers]);

  const dismissNotification = useCallback(() => {
    setShowAnalysisNotification(false);
  }, []);

  const closeResultsModal = useCallback(() => {
    setShowAnalysisResultsModal(false);
  }, []);

  return {
    analysisStatus,
    isAnalyzing,
    analysisJobId,
    showAnalysisNotification,
    showAnalysisResultsModal,
    startAnalysis,
    dismissNotification,
    closeResultsModal,
  };
}
