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
  backlog: 'bg-gray-100 border-gray-300',
  planning: 'bg-blue-50 border-blue-300',
  analysis: 'bg-purple-50 border-purple-300',
  architecture: 'bg-indigo-50 border-indigo-300',
  design: 'bg-pink-50 border-pink-300',
  implementation: 'bg-yellow-50 border-yellow-300',
  review: 'bg-orange-50 border-orange-300',
  qa: 'bg-green-50 border-green-300',
  done: 'bg-gray-50 border-gray-300',
  blocked: 'bg-red-50 border-red-300',
};

export function KanbanColumn({ status, title, stories, onStoryClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div className="flex flex-col min-w-[280px] max-w-[280px]">
      {/* Column Header */}
      <div className={clsx(
        'px-3 py-2 rounded-t-lg border-2 border-b-0',
        statusColors[status]
      )}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-700">
            {title}
          </h3>
          <span className="bg-white px-2 py-0.5 rounded-full text-xs font-medium text-gray-600">
            {stories.length}
          </span>
        </div>
      </div>

      {/* Column Body */}
      <div
        ref={setNodeRef}
        className={clsx(
          'flex-1 p-2 rounded-b-lg border-2 border-t-0 min-h-[200px]',
          statusColors[status],
          isOver && 'ring-2 ring-blue-400 ring-offset-2'
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
          <div className="text-center py-8 text-gray-400 text-sm">
            No stories
          </div>
        )}
      </div>
    </div>
  );
}
