/**
 * Tests for file tree helper utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getAllFiles,
  getFilesWithoutCoverage,
  getFilesWithCoverageGaps,
  toggleFolderExpansion,
  isFolderExpanded,
  getNodeDepth,
  findNodeByPath,
  countFiles,
  getHighRiskFiles,
} from '../fileTreeHelpers';
import { FolderNode } from '../../../types/codeQualityTypes';

const mockFileNode: FolderNode = {
  path: 'src/file.ts',
  name: 'file.ts',
  type: 'file',
  metrics: {
    fileCount: 1,
    totalLoc: 100,
    avgComplexity: 5,
    avgCognitiveComplexity: 8,
    avgMaintainability: 75,
    avgCoverage: 85,
    avgRiskScore: 20,
    uncoveredFiles: 0,
    criticalIssues: 0,
    healthScore: 80,
  },
};

const mockFolderNode: FolderNode = {
  path: 'src',
  name: 'src',
  type: 'folder',
  metrics: {
    fileCount: 2,
    totalLoc: 200,
    avgComplexity: 10,
    avgCognitiveComplexity: 15,
    avgMaintainability: 70,
    avgCoverage: 50,
    avgRiskScore: 30,
    uncoveredFiles: 1,
    criticalIssues: 2,
    healthScore: 60,
  },
  children: [mockFileNode, { ...mockFileNode, path: 'src/file2.ts', name: 'file2.ts', metrics: { ...mockFileNode.metrics, avgCoverage: 0 } }],
};

describe('fileTreeHelpers', () => {
  describe('getAllFiles', () => {
    it('should return file itself if node is a file', () => {
      const result = getAllFiles(mockFileNode);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('file');
    });

    it('should extract all files from folder hierarchy', () => {
      const result = getAllFiles(mockFolderNode);
      expect(result).toHaveLength(2);
      expect(result.every(f => f.type === 'file')).toBe(true);
    });
  });

  describe('getFilesWithoutCoverage', () => {
    it('should return files with 0% coverage', () => {
      const result = getFilesWithoutCoverage(mockFolderNode);
      expect(result).toHaveLength(1);
      expect(result[0].metrics.avgCoverage).toBe(0);
    });

    it('should return empty array for null root', () => {
      expect(getFilesWithoutCoverage(null)).toEqual([]);
    });
  });

  describe('getFilesWithCoverageGaps', () => {
    it('should return files with coverage between 0 and 80', () => {
      const result = getFilesWithCoverageGaps(mockFolderNode);
      expect(result.every(f => f.metrics.avgCoverage > 0 && f.metrics.avgCoverage < 80)).toBe(true);
    });
  });

  describe('toggleFolderExpansion', () => {
    it('should add folder if not present', () => {
      const folders = new Set<string>(['folder1']);
      const result = toggleFolderExpansion(folders, 'folder2');
      expect(result.has('folder2')).toBe(true);
    });

    it('should remove folder if present', () => {
      const folders = new Set<string>(['folder1']);
      const result = toggleFolderExpansion(folders, 'folder1');
      expect(result.has('folder1')).toBe(false);
    });
  });

  describe('isFolderExpanded', () => {
    it('should return true for expanded folders', () => {
      const folders = new Set<string>(['folder1']);
      expect(isFolderExpanded(folders, 'folder1')).toBe(true);
    });

    it('should return false for non-expanded folders', () => {
      const folders = new Set<string>(['folder1']);
      expect(isFolderExpanded(folders, 'folder2')).toBe(false);
    });
  });

  describe('getNodeDepth', () => {
    it('should calculate depth correctly', () => {
      expect(getNodeDepth('src')).toBe(1);
      expect(getNodeDepth('src/utils')).toBe(2);
      expect(getNodeDepth('src/utils/file.ts')).toBe(3);
    });
  });

  describe('findNodeByPath', () => {
    it('should find node by path', () => {
      const result = findNodeByPath(mockFolderNode, 'src/file.ts');
      expect(result?.path).toBe('src/file.ts');
    });

    it('should return null if not found', () => {
      const result = findNodeByPath(mockFolderNode, 'nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('countFiles', () => {
    it('should count all files in hierarchy', () => {
      expect(countFiles(mockFolderNode)).toBe(2);
    });

    it('should return 0 for null', () => {
      expect(countFiles(null)).toBe(0);
    });
  });

  describe('getHighRiskFiles', () => {
    it('should return files with risk score > 50', () => {
      const highRiskNode: FolderNode = {
        ...mockFolderNode,
        children: [{ ...mockFileNode, metrics: { ...mockFileNode.metrics, avgRiskScore: 60 } }],
      };
      const result = getHighRiskFiles(highRiskNode);
      expect(result.every(f => f.metrics.avgRiskScore > 50)).toBe(true);
    });
  });
});
