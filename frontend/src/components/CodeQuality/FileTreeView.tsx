/**
 * File Tree View Component
 * Recursive file tree with expand/collapse, metrics display, and keyboard navigation
 */

import React, { useCallback } from 'react';
import { FolderNode, FileDetail } from '../../types/codeQualityTypes';
import { getHealthColor } from '../../utils/codeQuality/healthCalculations';

interface FileTreeViewProps {
  tree: FolderNode[];
  expandedFolders: Set<string>;
  selectedFile: FileDetail | null;
  onToggleFolder: (path: string) => void;
  onSelectFile: (filePath: string) => void;
}

export const FileTreeView: React.FC<FileTreeViewProps> = ({
  tree,
  expandedFolders,
  selectedFile,
  onToggleFolder,
  onSelectFile,
}) => {
  const renderNode = useCallback(
    (node: FolderNode, depth: number = 0): React.ReactNode => {
      const isExpanded = expandedFolders.has(node.path);
      const isSelected = selectedFile?.filePath === node.path;
      const paddingLeft = depth * 16;

      if (node.type === 'folder') {
        return (
          <div key={node.path}>
            <div
              className="flex items-center py-2 px-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors"
              style={{ paddingLeft: `${paddingLeft}px` }}
              onClick={() => onToggleFolder(node.path)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggleFolder(node.path);
                }
              }}
              role="button"
              tabIndex={0}
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} folder ${node.name}`}
            >
              <span className="material-symbols-outlined text-gray-400 text-lg mr-2">
                {isExpanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right'}
              </span>
              <span className="material-symbols-outlined text-yellow-500 text-xl mr-2">
                folder
              </span>
              <span className="flex-1 text-gray-900 dark:text-white font-medium">
                {node.name}
              </span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-500">
                  Complexity: <span className={getHealthColor(100 - node.metrics.avgComplexity)}>{node.metrics.avgComplexity.toFixed(1)}</span>
                </span>
                <span className="text-gray-500">
                  Coverage: {node.metrics.avgCoverage.toFixed(1)}%
                </span>
                <div
                  className={`w-2 h-2 rounded-full ${getHealthColor(node.metrics.healthScore)}`}
                  title={`Health: ${node.metrics.healthScore.toFixed(0)}`}
                />
              </div>
            </div>
            {isExpanded && node.children && (
              <div>
                {node.children.map((child) => renderNode(child, depth + 1))}
              </div>
            )}
          </div>
        );
      }

      // File node
      return (
        <div
          key={node.path}
          className={`flex items-center py-2 px-3 cursor-pointer rounded transition-colors ${
            isSelected
              ? 'bg-primary/10 dark:bg-primary/20'
              : 'hover:bg-gray-100 dark:hover:bg-white/10'
          }`}
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => onSelectFile(node.path)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectFile(node.path);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Select file ${node.name}`}
          aria-current={isSelected ? 'true' : undefined}
        >
          <span className="material-symbols-outlined text-gray-400 text-xl mr-2 ml-6">
            description
          </span>
          <span className="flex-1 text-gray-900 dark:text-white">
            {node.name}
          </span>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-500">
              Complexity: <span className={getHealthColor(100 - node.metrics.avgComplexity)}>{node.metrics.avgComplexity.toFixed(1)}</span>
            </span>
            <span className="text-gray-500">
              Coverage: {node.metrics.avgCoverage.toFixed(1)}%
            </span>
            <div
              className={`w-2 h-2 rounded-full ${getHealthColor(node.metrics.healthScore)}`}
              title={`Health: ${node.metrics.healthScore.toFixed(0)}`}
            />
          </div>
        </div>
      );
    },
    [expandedFolders, selectedFile, onToggleFolder, onSelectFile]
  );

  return (
    <div className="bg-white dark:bg-[#1A202C] border border-gray-200 dark:border-[#3b4354] rounded-xl p-4">
      <div className="space-y-1">
        {tree.map((node) => renderNode(node, 0))}
      </div>
    </div>
  );
};
