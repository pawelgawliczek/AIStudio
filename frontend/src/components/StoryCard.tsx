import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Story, StoryType } from '../types';
import { ChatBubbleLeftIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface StoryCardProps {
  story: Story;
  onClick: (story: Story) => void;
}

const priorityStars = (priority: number) => {
  return '★'.repeat(Math.min(priority || 0, 5));
};

const getTypeIcon = (type: StoryType) => {
  switch (type) {
    case 'bug':
      return '🐛';
    case 'feature':
      return '✨';
    case 'tech_debt':
      return '🔧';
    case 'spike':
      return '🔬';
    default:
      return '📋';
  }
};

const getTypeColor = (type: StoryType) => {
  switch (type) {
    case 'bug':
      return 'bg-red-100 text-red-800';
    case 'feature':
      return 'bg-blue-100 text-blue-800';
    case 'tech_debt':
      return 'bg-yellow-100 text-yellow-800';
    case 'spike':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export function StoryCard({ story, onClick }: StoryCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: story.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const subtasksCompleted = story.subtasks?.filter(st => st.status === 'done').length || 0;
  const subtasksTotal = story.subtasks?.length || story._count?.subtasks || 0;
  const commentsCount = 0; // TODO: Implement comments

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(story)}
      className={clsx(
        'bg-white rounded-lg border border-gray-200 p-3 mb-2 cursor-pointer',
        'hover:shadow-md transition-shadow duration-200',
        'select-none'
      )}
    >
      {/* Header: Key + Priority */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-mono text-gray-600">{story.key}</span>
        <span className="text-yellow-500 text-sm">
          {priorityStars(story.businessImpact || 3)}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">
        {getTypeIcon(story.type)} {story.title}
      </h4>

      {/* Epic Tag (if present) */}
      {story.epic && (
        <div className="mb-2">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800"
            title={story.epic.title}
          >
            {story.epic.key}: {story.epic.title}
          </span>
        </div>
      )}

      {/* Components/Tags */}
      {story.project && (
        <div className="mb-2 flex flex-wrap gap-1">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
            {story.project.name.substring(0, 20)}
          </span>
        </div>
      )}

      {/* Assignee */}
      {story.assignedFramework && (
        <div className="flex items-center mb-2 text-xs text-gray-600">
          <span className="mr-1">👤</span>
          <span className="truncate">{story.assignedFramework.name}</span>
        </div>
      )}

      {/* Footer: Subtasks + Comments */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-3">
          {/* Subtasks */}
          {subtasksTotal > 0 && (
            <div className="flex items-center space-x-1">
              {subtasksCompleted === subtasksTotal ? (
                <CheckCircleIcon className="w-4 h-4 text-green-500" />
              ) : (
                <ExclamationTriangleIcon className="w-4 h-4 text-orange-500" />
              )}
              <span>
                {subtasksCompleted}/{subtasksTotal}
              </span>
            </div>
          )}

          {/* Comments */}
          {commentsCount > 0 && (
            <div className="flex items-center space-x-1">
              <ChatBubbleLeftIcon className="w-4 h-4" />
              <span>{commentsCount}</span>
            </div>
          )}
        </div>

        {/* Type Badge */}
        <span className={clsx(
          'px-2 py-0.5 rounded text-xs font-medium',
          getTypeColor(story.type)
        )}>
          {story.type}
        </span>
      </div>
    </div>
  );
}
