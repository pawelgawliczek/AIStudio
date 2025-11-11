import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Story, Epic } from '../../types';
import { PlanningItemCard } from './PlanningItemCard';
import { SubtasksList } from './SubtasksList';

interface EpicGroupProps {
  epic: Epic | null; // null for unassigned stories
  stories?: Story[];
  onEpicClick?: (epic: Epic) => void;
  onStoryClick: (story: Story) => void;
}

export function EpicGroup({ epic, stories: propStories, onEpicClick, onStoryClick }: EpicGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());

  const stories = propStories || epic?.stories || [];
  const isUnassigned = epic === null;

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
    if (stories.length === 0) return 0;
    const doneStories = stories.filter(s => s.status === 'done').length;
    return Math.round((doneStories / stories.length) * 100);
  };

  return (
    <div
      ref={setNodeRef}
      className={`border border-gray-200 rounded-lg overflow-hidden transition-colors ${
        isOver ? 'ring-2 ring-primary ring-opacity-50' : ''
      }`}
    >
      {/* Epic Header */}
      <div className="bg-blue-50 border-b border-blue-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            {/* Expand/Collapse Button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-blue-600 hover:text-blue-800 transition-colors"
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
                <h2 className="text-lg font-semibold text-gray-700">Unassigned Items</h2>
              ) : epic ? (
                <>
                  <div className="flex items-center gap-3">
                    <h2
                      className="text-lg font-semibold text-blue-900 cursor-pointer hover:text-blue-700"
                      onClick={() => onEpicClick && onEpicClick(epic)}
                    >
                      Epic: {epic.title}
                    </h2>
                    <span className="text-sm text-blue-600">#{epic.key}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-blue-700">
                    <span>Priority: {epic.priority}</span>
                    <span className="capitalize">{epic.status.replace('_', ' ')}</span>
                    <span>{stories.length} {stories.length === 1 ? 'Story' : 'Stories'}</span>
                    <span>Complete: {getCompletion()}%</span>
                  </div>
                </>
              ) : null}
            </div>

            {/* Add Story Button */}
            <button className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100 rounded transition-colors">
              + Story
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {!isUnassigned && stories.length > 0 && (
          <div className="mt-3">
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${getCompletion()}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stories List */}
      {isExpanded && (
        <div className="p-4 space-y-3 bg-white">
          {stories.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
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
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
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
