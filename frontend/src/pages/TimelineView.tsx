import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { storiesApi, epicsApi } from '../services/api';
import { Story, Epic, StoryStatus } from '../types';
import { format, parseISO, differenceInDays, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { useProject } from '../context/ProjectContext';

export function TimelineView() {
  const [searchParams] = useSearchParams();
  const { selectedProject } = useProject();
  const projectId = searchParams.get('projectId') || selectedProject?.id || '';

  const [selectedEpic, setSelectedEpic] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<StoryStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'quarter'>('month');

  // Fetch stories
  const { data: stories = [], isLoading: storiesLoading, error: storiesError } = useQuery({
    queryKey: ['stories', projectId],
    queryFn: () => storiesApi.getAll({ projectId }).then(res => res.data),
    enabled: !!projectId,
  });

  // Fetch epics
  const { data: epics = [], error: epicsError } = useQuery({
    queryKey: ['epics', projectId],
    queryFn: () => epicsApi.getAll(projectId).then(res => res.data),
    enabled: !!projectId,
  });

  // Filter stories
  const filteredStories = useMemo(() => {
    if (!Array.isArray(stories)) return [];
    let filtered = [...stories];

    if (selectedEpic !== 'all') {
      filtered = filtered.filter(s => s.epicId === selectedEpic);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(s => s.status === selectedStatus);
    }

    return filtered;
  }, [stories, selectedEpic, selectedStatus]);

  // Calculate timeline range
  const timelineRange = useMemo(() => {
    const today = new Date();
    const start = startOfWeek(today);

    let end: Date;
    switch (viewMode) {
      case 'week':
        end = endOfWeek(today);
        break;
      case 'month':
        end = addDays(start, 30);
        break;
      case 'quarter':
        end = addDays(start, 90);
        break;
      default:
        end = addDays(start, 30);
    }

    return { start, end };
  }, [viewMode]);

  // Group stories by epic
  const storiesByEpic = useMemo(() => {
    const grouped = new Map<string, Story[]>();

    filteredStories.forEach(story => {
      const epicId = story.epicId || 'no-epic';
      const existing = grouped.get(epicId) || [];
      grouped.set(epicId, [...existing, story]);
    });

    return grouped;
  }, [filteredStories]);

  // Calculate story position on timeline
  const getStoryPosition = (story: Story) => {
    // Use createdAt as start date, estimate end date based on complexity
    const startDate = parseISO(story.createdAt);
    const complexity = (story.businessComplexity || 3) + (story.technicalComplexity || 3);
    const estimatedDays = complexity * 2; // Rough estimate: each complexity point = 2 days
    const endDate = addDays(startDate, estimatedDays);

    const totalDays = differenceInDays(timelineRange.end, timelineRange.start);
    const startOffset = differenceInDays(startDate, timelineRange.start);
    const duration = differenceInDays(endDate, startDate);

    const leftPercent = (startOffset / totalDays) * 100;
    const widthPercent = (duration / totalDays) * 100;

    return {
      left: Math.max(0, Math.min(100, leftPercent)),
      width: Math.max(5, Math.min(100 - leftPercent, widthPercent)),
      startDate,
      endDate,
    };
  };

  const getStatusColor = (status: StoryStatus) => {
    switch (status) {
      case 'done':
        return 'bg-green-500';
      case 'blocked':
        return 'bg-red-500';
      case 'implementation':
      case 'review':
      case 'qa':
        return 'bg-blue-500';
      case 'planning':
      case 'analysis':
      case 'architecture':
      case 'design':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">No Project Selected</h2>
          <p className="mt-2 text-gray-600">Please select a project to view the timeline.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Timeline View</h1>
            <p className="mt-1 text-sm text-gray-600">
              {filteredStories.length} stories • {format(timelineRange.start, 'MMM d')} - {format(timelineRange.end, 'MMM d, yyyy')}
            </p>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 text-sm rounded-md ${
                viewMode === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 text-sm rounded-md ${
                viewMode === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('quarter')}
              className={`px-3 py-1 text-sm rounded-md ${
                viewMode === 'quarter'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Quarter
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-3 flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">Epic:</label>
        <select
          value={selectedEpic}
          onChange={(e) => setSelectedEpic(e.target.value)}
          className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Epics</option>
          {epics.map((epic: Epic) => (
            <option key={epic.id} value={epic.id}>
              {epic.key} - {epic.title}
            </option>
          ))}
        </select>

        <label className="text-sm font-medium text-gray-700">Status:</label>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as StoryStatus | 'all')}
          className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Statuses</option>
          <option value="backlog">Backlog</option>
          <option value="planning">Planning</option>
          <option value="analysis">Analysis</option>
          <option value="architecture">Architecture</option>
          <option value="design">Design</option>
          <option value="implementation">Implementation</option>
          <option value="review">Review</option>
          <option value="qa">QA</option>
          <option value="done">Done</option>
          <option value="blocked">Blocked</option>
        </select>

        {(selectedEpic !== 'all' || selectedStatus !== 'all') && (
          <button
            onClick={() => {
              setSelectedEpic('all');
              setSelectedStatus('all');
            }}
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto p-6">
        {storiesError || epicsError ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-red-500 text-5xl mb-4">⚠️</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to load timeline</h3>
              <p className="text-gray-600 mb-4">
                {storiesError ? 'Error loading stories. ' : ''}
                {epicsError ? 'Error loading epics. ' : ''}
                Please check if the backend server is running.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Reload Page
              </button>
            </div>
          </div>
        ) : storiesLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading timeline...</p>
            </div>
          </div>
        ) : filteredStories.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-gray-600">No stories to display</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            {/* Timeline Header (Date markers) */}
            <div className="flex mb-4 border-b pb-2">
              <div className="w-48 flex-shrink-0"></div>
              <div className="flex-1 relative">
                <div className="flex justify-between text-xs text-gray-500">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const date = addDays(
                      timelineRange.start,
                      (differenceInDays(timelineRange.end, timelineRange.start) / 9) * i
                    );
                    return (
                      <div key={i} className="text-center">
                        {format(date, 'MMM d')}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Stories grouped by Epic */}
            {Array.from(storiesByEpic.entries()).map(([epicId, epicStories]) => {
              const epic = epics.find((e: Epic) => e.id === epicId);

              return (
                <div key={epicId} className="mb-6">
                  {/* Epic Header */}
                  <div className="flex items-center mb-2">
                    <div className="w-48 flex-shrink-0">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {epic ? `${epic.key}: ${epic.title}` : 'No Epic'}
                      </h3>
                      <p className="text-xs text-gray-500">{epicStories.length} stories</p>
                    </div>
                  </div>

                  {/* Stories */}
                  <div className="space-y-1">
                    {epicStories.map(story => {
                      const position = getStoryPosition(story);
                      return (
                        <div key={story.id} className="flex items-center group">
                          <div className="w-48 flex-shrink-0 pr-4">
                            <div className="text-xs">
                              <span className="font-mono text-gray-600">{story.key}</span>
                              <p className="text-gray-900 truncate">{story.title}</p>
                            </div>
                          </div>
                          <div className="flex-1 relative h-8">
                            {/* Timeline bar */}
                            <div
                              className={`absolute top-1 h-6 rounded ${getStatusColor(story.status)} opacity-80 hover:opacity-100 transition-opacity cursor-pointer group-hover:ring-2 group-hover:ring-blue-500`}
                              style={{
                                left: `${position.left}%`,
                                width: `${position.width}%`,
                              }}
                              title={`${story.key}: ${story.title}\n${format(position.startDate, 'MMM d')} - ${format(position.endDate, 'MMM d')}\nStatus: ${story.status}`}
                            >
                              <div className="px-2 text-xs text-white font-medium truncate leading-6">
                                {story.key}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Legend */}
            <div className="mt-6 pt-4 border-t">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">Status Legend:</h4>
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-gray-400 rounded"></div>
                  <span>Backlog</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span>Planning/Analysis/Architecture/Design</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span>Implementation/Review/QA</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>Done</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span>Blocked</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
