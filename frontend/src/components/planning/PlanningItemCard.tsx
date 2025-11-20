import { useDraggable } from '@dnd-kit/core';
import { Story, Epic, StoryType } from '../../types';

interface PlanningItemCardProps {
  item: Story | Epic;
  onClick: (item: Story | Epic) => void;
  showEpicBadge?: boolean;
  isDragging?: boolean;
}

export function PlanningItemCard({ item, onClick, showEpicBadge = false, isDragging = false }: PlanningItemCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const isEpic = !('status' in item);
  const story = !isEpic ? (item as Story) : null;
  const epic = isEpic ? (item as Epic) : null;

  // Calculate completion percentage for epics
  const getEpicCompletion = (epic: Epic) => {
    if (!epic.stories || epic.stories.length === 0) return 0;
    const doneStories = epic.stories.filter(s => s.status === 'done').length;
    return Math.round((doneStories / epic.stories.length) * 100);
  };

  // Get color for story type
  const getTypeColor = (type: StoryType) => {
    switch (type) {
      case 'feature':
        return 'border-l-blue-500';
      case 'bug':
        return 'border-l-red-500';
      case 'chore':
        return 'border-l-orange-500';
      case 'spike':
        return 'border-l-purple-500';
      default:
        return 'border-l-gray-500';
    }
  };

  // Render stars for complexity/impact
  const renderStars = (count?: number) => {
    if (!count) return null;
    return (
      <span className="flex items-center">
        {Array.from({ length: count }).map((_, i) => (
          <svg key={i} className="w-3 h-3 text-yellow-400 fill-current" viewBox="0 0 20 20">
            <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
          </svg>
        ))}
      </span>
    );
  };

  if (isEpic && epic) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`bg-blue-50 dark:bg-blue-900/20 border border-border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow ${
          isDragging ? 'opacity-50' : ''
        }`}
        onClick={() => onClick(epic)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1">
            {/* Drag Handle */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted hover:text-fg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </div>

            <div className="flex-1">
              <h3 className="text-lg font-semibold text-fg">{epic.title}</h3>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted">
                <span>Priority: {epic.priority}</span>
                <span className="capitalize">{epic.status.replace('_', ' ')}</span>
                <span>{epic._count?.stories || 0} Stories</span>
                <span>{getEpicCompletion(epic)}% Complete</span>
              </div>
              {epic.description && (
                <p className="mt-2 text-sm text-muted line-clamp-2">{epic.description}</p>
              )}
            </div>
          </div>

          {/* Expand Icon (will be handled by EpicGroup) */}
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    );
  }

  if (story) {
    const typeColor = getTypeColor(story.type);

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`bg-card border border-border border-l-4 ${typeColor} rounded-lg p-4 cursor-pointer hover:shadow-md transition-all ${
          isDragging ? 'opacity-50' : ''
        }`}
        onClick={() => onClick(story)}
      >
        <div className="flex items-start gap-3">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted hover:text-fg mt-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-muted">{story.key}</span>
              <span className="px-2 py-0.5 text-xs font-medium bg-bg-secondary text-fg rounded capitalize">
                {story.type.replace('_', ' ')}
              </span>
              {showEpicBadge && story.epic && (
                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                  {story.epic.title}
                </span>
              )}
            </div>

            <h4 className="font-medium text-fg mb-2">{story.title}</h4>

            <div className="flex items-center gap-4 text-xs text-muted">
              <span className="capitalize">Impact: {story.businessImpact || 0}</span>
              {story.status === 'done' ? (
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded font-medium">Done</span>
              ) : (
                <span className="capitalize">{story.status.replace('_', ' ')}</span>
              )}
              {story._count?.subtasks && story._count.subtasks > 0 && (
                <span>{story._count.subtasks} Subtasks</span>
              )}
              {story.businessComplexity && (
                <span className="flex items-center gap-1">
                  Business: {renderStars(story.businessComplexity)}
                </span>
              )}
              {story.technicalComplexity && (
                <span className="flex items-center gap-1">
                  Technical: {renderStars(story.technicalComplexity)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
