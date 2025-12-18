import { useDroppable } from '@dnd-kit/core';
import { useState } from 'react';
import { Story, Epic } from '../../types';
import { PlanningItemCard } from './PlanningItemCard';
import { SubtasksList } from './SubtasksList';

interface EpicGroupProps {
  epic: Epic | null; // null for unassigned stories
  stories?: Story[];
  onEpicClick?: (epic: Epic) => void;
  onStoryClick: (story: Story) => void;
  onAddStory?: (epicId: string | null) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  hideCompletedItems?: boolean;
}

export function EpicGroup({ epic, stories: propStories, onEpicClick, onStoryClick, onAddStory, isExpanded: propIsExpanded, onToggleExpand, hideCompletedItems = false }: EpicGroupProps) {
  // Use prop isExpanded if provided, otherwise default to true for unassigned group
  const isExpanded = propIsExpanded !== undefined ? propIsExpanded : true;
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());

  const allStories = propStories || epic?.stories || [];
  const isUnassigned = epic === null;

  // Filter stories based on hideCompletedItems
  const stories = hideCompletedItems
    ? allStories.filter(s => s.status !== 'done')
    : allStories;

  // Count of hidden completed stories
  const hiddenCompletedCount = allStories.filter(s => s.status === 'done').length;

  const { setNodeRef, isOver } = useDroppable({
    id: epic?.id || 'unassigned',
  });

  const toggleSubtasks = (storyId: string) => {
    const newExpanded = new Set(expandedSubtasks);
    if (newExpanded.has(storyId)) {
      newExpanded.delete(storyId);
    } else {
      newExpanded.add(storyId);
    }
    setExpandedSubtasks(newExpanded);
  };

  // Calculate completion for epic
  const getCompletion = () => {
    if (allStories.length === 0) return 0;
    const doneStories = allStories.filter(s => s.status === 'done').length;
    return Math.round((doneStories / allStories.length) * 100);
  };

  return (
    <div
      ref={setNodeRef}
      className={`border border-border rounded-lg overflow-hidden transition-colors ${
        isOver ? 'ring-2 ring-primary-600 dark:ring-primary-500 ring-opacity-50' : ''
      }`}
    >
      {/* Epic Header */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            {/* Expand/Collapse Button */}
            <button
              onClick={() => onToggleExpand && onToggleExpand()}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            >
              <svg
                className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <div className="flex-1">
              {isUnassigned ? (
                <h2 className="text-lg font-semibold text-fg">Unassigned Items</h2>
              ) : epic ? (
                <>
                  <div className="flex items-center gap-3">
                    <h2
                      className="text-lg font-semibold text-fg cursor-pointer hover:text-accent"
                      onClick={() => onEpicClick && onEpicClick(epic)}
                    >
                      Epic: {epic.title}
                    </h2>
                    <span className="text-sm text-blue-600 dark:text-blue-400">#{epic.key}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted">
                    <span>Priority: {epic.priority}</span>
                    <span className="capitalize">{epic.status.replace('_', ' ')}</span>
                    <span>{allStories.length} {allStories.length === 1 ? 'Story' : 'Stories'}</span>
                    <span>Complete: {getCompletion()}%</span>
                    {hideCompletedItems && hiddenCompletedCount > 0 && (
                      <span className="text-green-600 dark:text-green-400">({hiddenCompletedCount} completed hidden)</span>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Add Story Button */}
            <button
              onClick={() => onAddStory && onAddStory(epic?.id || null)}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
            >
              + Story
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {!isUnassigned && stories.length > 0 && (
          <div className="mt-3">
            <div className="w-full bg-blue-200 dark:bg-blue-800/30 rounded-full h-2">
              <div
                className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${getCompletion()}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stories List */}
      {isExpanded && (
        <div className="p-4 space-y-3 bg-card">
          {stories.length === 0 ? (
            <div className="text-center py-8 text-muted">
              {isUnassigned ? 'No unassigned stories' : 'No stories in this epic'}
            </div>
          ) : (
            stories.map((story) => (
              <div key={story.id} className="space-y-2">
                <PlanningItemCard item={story} onClick={onStoryClick} />

                {/* Subtasks Toggle */}
                {story.subtasks && story.subtasks.length > 0 && (
                  <div className="ml-12">
                    <button
                      onClick={() => toggleSubtasks(story.id)}
                      className="flex items-center gap-2 text-sm text-muted hover:text-fg transition-colors"
                    >
                      <svg
                        className={`w-4 h-4 transition-transform ${
                          expandedSubtasks.has(story.id) ? 'rotate-90' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span>{story.subtasks.length} Subtasks</span>
                    </button>

                    {expandedSubtasks.has(story.id) && (
                      <div className="mt-2">
                        <SubtasksList subtasks={story.subtasks} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
