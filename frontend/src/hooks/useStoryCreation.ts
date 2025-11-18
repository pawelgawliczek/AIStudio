/**
 * Custom hook for story creation from code quality issues
 * Handles story modal state, content generation, and API calls
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { storiesService } from '../services/stories.service';
import { StoryType } from '../types';
import {
  FileHotspot,
  CodeIssue,
  FolderNode,
  StoryCreationContext,
} from '../types/codeQualityTypes';

interface UseStoryCreationReturn {
  isStoryModalOpen: boolean;
  storyTitle: string;
  storyDescription: string;
  storyContext: StoryCreationContext | null;
  creatingStory: boolean;
  createStoryForFile: (file: FileHotspot) => void;
  createStoryForIssue: (issue: CodeIssue) => void;
  createStoryForFolder: (folder: FolderNode) => void;
  saveStory: () => Promise<void>;
  closeModal: () => void;
  setStoryTitle: (title: string) => void;
  setStoryDescription: (description: string) => void;
}

export function useStoryCreation(
  projectId: string | undefined
): UseStoryCreationReturn {
  const navigate = useNavigate();
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [storyTitle, setStoryTitle] = useState('');
  const [storyDescription, setStoryDescription] = useState('');
  const [storyContext, setStoryContext] = useState<StoryCreationContext | null>(null);
  const [creatingStory, setCreatingStory] = useState(false);

  const createStoryForFile = useCallback((file: FileHotspot) => {
    const title = `Refactor high-risk file: ${file.filePath.split('/').pop()}`;
    const description =
      `## File Hotspot Analysis\n\n` +
      `**File:** \`${file.filePath}\`\n` +
      `**Risk Score:** ${file.riskScore}/100\n` +
      `**Complexity:** ${file.complexity}\n` +
      `**Churn Count:** ${file.churnCount}\n` +
      `**Coverage:** ${file.coverage}%\n` +
      `**LOC:** ${file.loc}\n` +
      `**Critical Issues:** ${file.criticalIssues}\n\n` +
      `### Identified Problems:\n` +
      `- ${file.complexity > 20 ? '🔴 Very high complexity' : file.complexity > 10 ? '⚠️ High complexity' : '✓ Acceptable'}\n` +
      `- ${file.churnCount > 5 ? '🔴 Very high churn' : file.churnCount > 3 ? '⚠️ High churn' : '✓ Acceptable'}\n` +
      `- ${file.coverage < 50 ? '🔴 Very low coverage' : file.coverage < 70 ? '⚠️ Low coverage' : '✓ Acceptable'}\n\n` +
      `### Refactoring Goals:\n` +
      `- [ ] Reduce complexity to < 10\n` +
      `- [ ] Add tests (target: ${file.coverage < 50 ? '70' : '80'}%+ coverage)\n` +
      `- [ ] ${file.criticalIssues > 0 ? `Fix ${file.criticalIssues} critical issue(s)` : 'No critical issues'}\n` +
      `- [ ] Reduce risk score to < 50`;

    setStoryTitle(title);
    setStoryDescription(description);
    setStoryContext({ type: 'file', data: file });
    setIsStoryModalOpen(true);
  }, []);

  const createStoryForIssue = useCallback((issue: CodeIssue) => {
    const title = `Fix ${issue.severity} ${issue.type.toLowerCase()}`;
    const description =
      `## Code Issue Report\n\n` +
      `**Severity:** ${issue.severity.toUpperCase()}\n` +
      `**Issue Type:** ${issue.type}\n` +
      `**Occurrences:** ${issue.count}\n` +
      `**Files Affected:** ${issue.filesAffected}\n\n` +
      `${issue.sampleFiles.length > 0 ? `### Sample Files:\n${issue.sampleFiles.map(f => `- \`${f}\``).join('\n')}\n\n` : ''}` +
      `### Tasks:\n` +
      `- [ ] Review all affected files\n` +
      `- [ ] Fix ${issue.count} occurrence(s)\n` +
      `- [ ] Add tests to prevent regression\n` +
      `- [ ] Update documentation if needed\n\n` +
      `### Acceptance Criteria:\n` +
      `- [ ] All occurrences resolved\n` +
      `- [ ] No new issues introduced\n` +
      `- [ ] Tests passing`;

    setStoryTitle(title);
    setStoryDescription(description);
    setStoryContext({ type: 'issue', data: issue });
    setIsStoryModalOpen(true);
  }, []);

  const createStoryForFolder = useCallback((folder: FolderNode) => {
    const isFile = folder.type === 'file';
    const title = isFile
      ? `Refactor: ${folder.name}`
      : `Improve code quality in ${folder.path || 'root'}`;

    const description = isFile
      ? `## File Analysis\n\n` +
        `**File:** \`${folder.path}\`\n` +
        `**Complexity:** ${folder.metrics.avgComplexity}\n` +
        `**Coverage:** ${folder.metrics.avgCoverage}%\n` +
        `**Maintainability:** ${folder.metrics.avgMaintainability}/100\n`
      : `## Folder Analysis\n\n` +
        `**Folder:** \`${folder.path}\`\n` +
        `**Files:** ${folder.metrics.fileCount}\n` +
        `**Total LOC:** ${folder.metrics.totalLoc}\n` +
        `**Avg Complexity:** ${folder.metrics.avgComplexity}\n` +
        `**Avg Coverage:** ${folder.metrics.avgCoverage}%\n` +
        `**Health Score:** ${folder.metrics.healthScore}/100\n`;

    setStoryTitle(title);
    setStoryDescription(description);
    setStoryContext({ type: 'folder', data: folder });
    setIsStoryModalOpen(true);
  }, []);

  const saveStory = useCallback(async () => {
    if (!storyTitle.trim() || !projectId) {
      alert('Please enter a story title');
      return;
    }

    try {
      setCreatingStory(true);
      await storiesService.create({
        projectId,
        title: storyTitle,
        description: storyDescription,
        type: StoryType.CHORE,
      });

      alert('Story created successfully!');
      setIsStoryModalOpen(false);
      setStoryTitle('');
      setStoryDescription('');
      setStoryContext(null);

      navigate(`/projects/${projectId}/planning`);
    } catch (error: any) {
      alert(`Failed to create story: ${error.message}`);
    } finally {
      setCreatingStory(false);
    }
  }, [storyTitle, storyDescription, projectId, navigate]);

  const closeModal = useCallback(() => {
    setIsStoryModalOpen(false);
    setStoryTitle('');
    setStoryDescription('');
    setStoryContext(null);
  }, []);

  return {
    isStoryModalOpen,
    storyTitle,
    storyDescription,
    storyContext,
    creatingStory,
    createStoryForFile,
    createStoryForIssue,
    createStoryForFolder,
    saveStory,
    closeModal,
    setStoryTitle,
    setStoryDescription,
  };
}
