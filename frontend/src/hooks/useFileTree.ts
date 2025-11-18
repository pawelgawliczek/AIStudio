/**
 * Custom hook for file tree state and interactions
 * Handles folder expansion, file selection, and file detail fetching
 */

import { useState, useCallback } from 'react';
import axios from '../lib/axios';
import { FileDetail, DrillDownLevel } from '../types/codeQualityTypes';
import { toggleFolderExpansion } from '../utils/codeQuality/fileTreeHelpers';

interface UseFileTreeReturn {
  expandedFolders: Set<string>;
  drillDownLevel: DrillDownLevel;
  selectedFile: FileDetail | null;
  loadingDetail: boolean;
  toggleFolder: (path: string) => void;
  selectFile: (filePath: string) => Promise<void>;
  backToProject: () => void;
}

export function useFileTree(projectId: string | undefined): UseFileTreeReturn {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [drillDownLevel, setDrillDownLevel] = useState<DrillDownLevel>('project');
  const [selectedFile, setSelectedFile] = useState<FileDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => toggleFolderExpansion(prev, path));
  }, []);

  const selectFile = useCallback(
    async (filePath: string) => {
      if (!projectId) return;

      setLoadingDetail(true);
      try {
        const response = await axios.get(
          `/code-metrics/file/${projectId}?filePath=${encodeURIComponent(filePath)}`
        );
        setSelectedFile(response.data);
        setDrillDownLevel('file');
      } catch (error: any) {
        console.error('Failed to fetch file details:', error);
      } finally {
        setLoadingDetail(false);
      }
    },
    [projectId]
  );

  const backToProject = useCallback(() => {
    setDrillDownLevel('project');
    setSelectedFile(null);
  }, []);

  return {
    expandedFolders,
    drillDownLevel,
    selectedFile,
    loadingDetail,
    toggleFolder,
    selectFile,
    backToProject,
  };
}
