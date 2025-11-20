/**
 * File tree manipulation utilities for Code Quality Dashboard
 * Pure functions for working with folder hierarchy
 */

import { FolderNode } from '../../types/codeQualityTypes';

/**
 * Extract all files from a folder hierarchy
 * @param node - Root folder node
 * @returns Flat array of all file nodes
 */
export function getAllFiles(node: FolderNode): FolderNode[] {
  const files: FolderNode[] = [];

  if (node.type === 'file') {
    files.push(node);
  } else if (node.children) {
    for (const child of node.children) {
      files.push(...getAllFiles(child));
    }
  }

  return files;
}

/**
 * Get files without any test coverage
 * @param root - Root folder node
 * @returns Array of file nodes with 0% coverage
 */
export function getFilesWithoutCoverage(root: FolderNode | null): FolderNode[] {
  if (!root) return [];
  const allFiles = getAllFiles(root);
  return allFiles.filter(file => file.metrics.avgCoverage === 0);
}

/**
 * Get files with coverage gaps (>0% but <80%)
 * @param root - Root folder node
 * @returns Array of file nodes with low coverage, sorted by coverage ascending
 */
export function getFilesWithCoverageGaps(root: FolderNode | null): FolderNode[] {
  if (!root) return [];
  const allFiles = getAllFiles(root);
  return allFiles
    .filter(file => file.metrics.avgCoverage > 0 && file.metrics.avgCoverage < 80)
    .sort((a, b) => a.metrics.avgCoverage - b.metrics.avgCoverage);
}

/**
 * Toggle folder expansion state
 * @param expandedFolders - Current set of expanded folder paths
 * @param path - Path to toggle
 * @returns New set with path toggled
 */
export function toggleFolderExpansion(
  expandedFolders: Set<string>,
  path: string
): Set<string> {
  const newExpanded = new Set(expandedFolders);
  if (newExpanded.has(path)) {
    newExpanded.delete(path);
  } else {
    newExpanded.add(path);
  }
  return newExpanded;
}

/**
 * Check if a folder is expanded
 * @param expandedFolders - Set of expanded folder paths
 * @param path - Path to check
 * @returns True if folder is expanded
 */
export function isFolderExpanded(
  expandedFolders: Set<string>,
  path: string
): boolean {
  return expandedFolders.has(path);
}

/**
 * Get depth of a node in the tree (for indentation)
 * @param path - File or folder path
 * @returns Depth level (number of slashes)
 */
export function getNodeDepth(path: string): number {
  return path.split('/').filter(Boolean).length;
}

/**
 * Find a node by path in the hierarchy
 * @param root - Root folder node
 * @param targetPath - Path to find
 * @returns Found node or null
 */
export function findNodeByPath(
  root: FolderNode | null,
  targetPath: string
): FolderNode | null {
  if (!root) return null;
  if (root.path === targetPath) return root;

  if (root.children) {
    for (const child of root.children) {
      const found = findNodeByPath(child, targetPath);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Count total files in a hierarchy
 * @param node - Root folder node
 * @returns Total number of files
 */
export function countFiles(node: FolderNode | null): number {
  if (!node) return 0;
  return getAllFiles(node).length;
}

/**
 * Get high risk files (risk score > 50)
 * @param root - Root folder node
 * @returns Array of high-risk file nodes, sorted by risk score descending
 */
export function getHighRiskFiles(root: FolderNode | null): FolderNode[] {
  if (!root) return [];
  const allFiles = getAllFiles(root);
  return allFiles
    .filter(file => file.metrics.avgRiskScore > 50)
    .sort((a, b) => b.metrics.avgRiskScore - a.metrics.avgRiskScore);
}
