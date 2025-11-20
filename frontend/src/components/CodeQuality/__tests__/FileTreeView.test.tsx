/**
 * Tests for FileTreeView component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileTreeView } from '../FileTreeView';

const mockTree = [
  {
    path: 'src',
    name: 'src',
    type: 'folder' as const,
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
    children: [
      {
        path: 'src/file.ts',
        name: 'file.ts',
        type: 'file' as const,
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
      },
    ],
  },
];

describe('FileTreeView', () => {
  it('should render folder nodes', () => {
    render(
      <FileTreeView
        tree={mockTree}
        expandedFolders={new Set()}
        selectedFile={null}
        onToggleFolder={vi.fn()}
        onSelectFile={vi.fn()}
      />
    );
    expect(screen.getByText('src')).toBeInTheDocument();
  });

  it('should call onToggleFolder when folder is clicked', () => {
    const onToggleFolder = vi.fn();
    render(
      <FileTreeView
        tree={mockTree}
        expandedFolders={new Set()}
        selectedFile={null}
        onToggleFolder={onToggleFolder}
        onSelectFile={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('src'));
    expect(onToggleFolder).toHaveBeenCalledWith('src');
  });
});
