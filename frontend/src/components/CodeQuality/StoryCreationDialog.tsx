/**
 * Story Creation Dialog Component
 * Modal dialog for creating stories from code quality issues
 */

import React from 'react';
import {
  DocumentTextIcon,
  BugAntIcon,
  FolderIcon,
  DocumentPlusIcon,
  XMarkIcon,
  LightBulbIcon,
  ArrowPathIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { StoryCreationContext } from '../../types/codeQualityTypes';

interface StoryCreationDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  context: StoryCreationContext | null;
  isCreating: boolean;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export const StoryCreationDialog: React.FC<StoryCreationDialogProps> = ({
  isOpen,
  title,
  description,
  context,
  isCreating,
  onTitleChange,
  onDescriptionChange,
  onSave,
  onClose,
}) => {
  if (!isOpen) return null;

  const getContextLabel = () => {
    if (!context) return null;

    switch (context.type) {
      case 'file': {
        const fileData = context.data as any;
        return (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <DocumentTextIcon className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-900 dark:text-blue-200">
              File: {fileData.filePath || fileData.path}
            </span>
          </div>
        );
      }
      case 'issue': {
        const issueData = context.data as any;
        return (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <BugAntIcon className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-900 dark:text-red-200">
              Issue: {issueData.type} ({issueData.severity})
            </span>
          </div>
        );
      }
      case 'folder': {
        const folderData = context.data as any;
        return (
          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <FolderIcon className="w-4 h-4 text-yellow-600" />
            <span className="text-sm text-yellow-900 dark:text-yellow-200">
              Folder: {folderData.path}
            </span>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white dark:bg-[#1A202C] border border-gray-200 dark:border-[#3b4354] rounded-xl shadow-2xl w-full max-w-full md:max-w-3xl mx-4 md:mx-0 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#3b4354]">
          <div className="flex items-center gap-3">
            <DocumentPlusIcon className="w-7 h-7 text-primary" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Create Story from Code Quality Analysis
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close dialog"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Context Label */}
          {context && <div>{getContextLabel()}</div>}

          {/* Title Input */}
          <div>
            <label
              htmlFor="story-title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Story Title
            </label>
            <input
              id="story-title"
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Enter story title..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-[#3b4354] rounded-lg bg-white dark:bg-[#282e39] text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={isCreating}
              autoFocus
            />
          </div>

          {/* Description Textarea */}
          <div>
            <label
              htmlFor="story-description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Story Description
            </label>
            <textarea
              id="story-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Enter story description (markdown supported)..."
              rows={12}
              className="w-full px-4 py-2 border border-gray-300 dark:border-[#3b4354] rounded-lg bg-white dark:bg-[#282e39] text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
              disabled={isCreating}
            />
          </div>

          {/* AI Suggestions Hint */}
          <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <LightBulbIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm text-blue-900 dark:text-blue-200">
              <p className="font-medium mb-1">AI-Generated Content</p>
              <p className="text-blue-700 dark:text-blue-300">
                This description has been auto-generated based on the code quality analysis.
                Feel free to edit it before creating the story.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-[#3b4354]">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isCreating || !title.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? (
              <>
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <CheckIcon className="w-5 h-5" />
                <span>Create Story</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
