import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Story, StoryStatus } from '../types';
import { StoryCard } from './StoryCard';
import clsx from 'clsx';

interface KanbanColumnProps {
  status: StoryStatus;
  title: string;
  stories: Story[];
  onStoryClick: (story: Story) => void;
}

const statusColors: Record<StoryStatus, string> = {
  backlog: 'bg-gray-500/5 border-gray-500/20',
  planning: 'bg-blue-500/5 border-blue-500/20',
  analysis: 'bg-purple-500/5 border-purple-500/20',
  architecture: 'bg-indigo-500/5 border-indigo-500/20',
  design: 'bg-pink-500/5 border-pink-500/20',
  implementation: 'bg-yellow-500/5 border-yellow-500/20',
  review: 'bg-orange-500/5 border-orange-500/20',
  qa: 'bg-green-500/5 border-green-500/20',
  done: 'bg-gray-500/5 border-gray-500/20',
  blocked: 'bg-red-500/5 border-red-500/20',
};

export function KanbanColumn({ status, title, stories, onStoryClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div className="flex flex-col min-w-[280px] max-w-[280px]">
      {/* Column Header */}
      <div className={clsx(
        'px-4 py-3 rounded-t-lg border-2 border-b-0',
        statusColors[status]
      )}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-fg">
            {title}
          </h3>
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-card border border-border text-muted">
            {stories.length}
          </span>
        </div>
      </div>

      {/* Column Body */}
      <div
        ref={setNodeRef}
        className={clsx(
          'flex-1 p-2 rounded-b-lg border-2 border-t-0 min-h-[200px] transition-all',
          statusColors[status],
          isOver && 'ring-2 ring-accent ring-offset-2'
        )}
      >
        <SortableContext
          items={stories.map(s => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {stories.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                onClick={onStoryClick}
              />
            ))}
          </div>
        </SortableContext>

        {stories.length === 0 && (
          <div className="text-center py-8 text-muted text-sm">
            No stories
          </div>
        )}
      </div>
    </div>
  );
}
