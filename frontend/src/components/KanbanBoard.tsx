import { useState, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { Story, StoryStatus } from '../types';
import { KanbanColumn } from './KanbanColumn';
import { StoryCard } from './StoryCard';

interface KanbanBoardProps {
  stories: Story[];
  onStoryClick: (story: Story) => void;
  onStatusChange: (storyId: string, newStatus: StoryStatus) => void;
}

const columns: { status: StoryStatus; title: string }[] = [
  { status: StoryStatus.backlog, title: 'Backlog' },
  { status: StoryStatus.planning, title: 'Planning' },
  { status: StoryStatus.analysis, title: 'Analysis' },
  { status: StoryStatus.architecture, title: 'Architecture' },
  { status: StoryStatus.implementation, title: 'Implementation' },
  { status: StoryStatus.review, title: 'Review' },
  { status: StoryStatus.qa, title: 'QA' },
  { status: StoryStatus.done, title: 'Done' },
];

export function KanbanBoard({ stories, onStoryClick, onStatusChange }: KanbanBoardProps) {
  const [activeStory, setActiveStory] = useState<Story | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Group stories by status
  const storiesByStatus = useMemo(() => {
    const grouped: Record<StoryStatus, Story[]> = {
      backlog: [],
      planning: [],
      analysis: [],
      architecture: [],
      design: [],
      implementation: [],
      review: [],
      qa: [],
      done: [],
      blocked: [],
    };

    stories.forEach((story) => {
      if (grouped[story.status]) {
        grouped[story.status].push(story);
      }
    });

    return grouped;
  }, [stories]);

  const handleDragStart = (event: DragStartEvent) => {
    const story = stories.find(s => s.id === event.active.id);
    setActiveStory(story || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveStory(null);
      return;
    }

    const storyId = active.id as string;
    const newStatus = over.id as StoryStatus;

    const story = stories.find(s => s.id === storyId);
    if (story && story.status !== newStatus) {
      onStatusChange(storyId, newStatus);
    }

    setActiveStory(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(({ status, title }) => (
          <KanbanColumn
            key={status}
            status={status}
            title={title}
            stories={storiesByStatus[status]}
            onStoryClick={onStoryClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeStory ? (
          <div className="rotate-3">
            <StoryCard story={activeStory} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
