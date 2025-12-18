import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChatBubbleLeftIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { Story, StoryType } from '../types';

interface StoryCardProps {
  story: Story;
  onClick: (story: Story) => void;
}

const priorityStars = (priority: number) => {
  return '★'.repeat(Math.min(priority || 0, 5));
};

const getTypeIcon = (type: StoryType) => {
  switch (type) {
    case StoryType.BUG:
      return '🐛';
    case StoryType.FEATURE:
      return '✨';
    case StoryType.CHORE:
      return '🔧';
    case StoryType.DEFECT:
      return '❌';
    case StoryType.SPIKE:
      return '🔬';
    default:
      return '📋';
  }
};

const getTypeColor = (type: StoryType) => {
  switch (type) {
    case StoryType.BUG:
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    case StoryType.FEATURE:
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case StoryType.CHORE:
      return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    case StoryType.DEFECT:
      return 'bg-red-600/10 text-red-700 border-red-600/20';
    case StoryType.SPIKE:
      return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    default:
      return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
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
        'bg-card border border-border rounded-lg shadow-md p-4 mb-2 cursor-pointer',
        'hover:shadow-lg hover:scale-[1.02] transition-all',
        'select-none'
      )}
    >
      {/* Header: Key + Priority */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-muted">{story.key}</span>
          {story.status === 'blocked' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 border border-red-200" title="Story is blocked">
              ⚠️ Blocked
            </span>
          )}
        </div>
        <span className="text-yellow-500 text-sm">
          {priorityStars(story.businessImpact || 3)}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-fg mb-3 line-clamp-2">
        {getTypeIcon(story.type)} {story.title}
      </h4>

      {/* Epic Tag (if present) */}
      {story.epic && (
        <div className="mb-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20">
            {story.epic.key}
          </span>
        </div>
      )}

      {/* Layers & Components */}
      {(story.layers && story.layers.length > 0) || (story.components && story.components.length > 0) ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {story.layers && story.layers.slice(0, 2).map((sl) => (
            <span
              key={sl.layer.id}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: `${sl.layer.color}15`,
                color: sl.layer.color || '#6366F1',
                borderWidth: '1px',
                borderColor: `${sl.layer.color}30`,
              }}
            >
              {sl.layer.icon} {sl.layer.name}
            </span>
          ))}
          {story.components && story.components.slice(0, 2).map((sc) => (
            <span
              key={sc.component.id}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: `${sc.component.color}15`,
                color: sc.component.color || '#10B981',
                borderWidth: '1px',
                borderColor: `${sc.component.color}30`,
              }}
            >
              {sc.component.icon} {sc.component.name}
            </span>
          ))}
          {((story.layers?.length || 0) + (story.components?.length || 0)) > 4 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500/10 text-gray-600">
              +{((story.layers?.length || 0) + (story.components?.length || 0)) - 4}
            </span>
          )}
        </div>
      ) : null}

      {/* Project Tag */}
      {story.project && (
        <div className="mb-2 flex flex-wrap gap-1">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-600 border border-gray-500/20">
            {story.project.name.substring(0, 20)}
          </span>
        </div>
      )}

      {/* Assignee */}
      {story.assignedFramework && (
        <div className="flex items-center mb-2 text-xs text-muted">
          <span className="mr-1">👤</span>
          <span className="truncate">{story.assignedFramework.name}</span>
        </div>
      )}

      {/* Footer: Subtasks + Comments */}
      <div className="flex items-center justify-between text-xs text-muted">
        <div className="flex items-center gap-3">
          {/* Subtasks */}
          {subtasksTotal > 0 && (
            <div className="flex items-center gap-1">
              {subtasksCompleted === subtasksTotal ? (
                <CheckCircleIcon className="w-4 h-4 text-green-600" />
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
            <div className="flex items-center gap-1">
              <ChatBubbleLeftIcon className="w-4 h-4" />
              <span>{commentsCount}</span>
            </div>
          )}
        </div>

        {/* Type Badge */}
        <span className={clsx(
          'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border',
          getTypeColor(story.type)
        )}>
          {story.type}
        </span>
      </div>
    </div>
  );
}
