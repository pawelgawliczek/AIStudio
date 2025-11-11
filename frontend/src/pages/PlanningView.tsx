import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Story, StoryStatus, StoryType, Epic } from '../types';
import { storiesApi, epicsApi, runsApi, commitsApi } from '../services/api';
import { KanbanBoard } from '../components/KanbanBoard';
import { StoryFilters } from '../components/StoryFilters';
import { StoryDetailDrawer } from '../components/StoryDetailDrawer';
import { useWebSocket, useStoryEvents } from '../services/websocket.service';

export function PlanningView() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || '';

  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEpic, setSelectedEpic] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<StoryStatus | 'all'>('all');
  const [selectedType, setSelectedType] = useState<StoryType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const queryClient = useQueryClient();
  const { isConnected, joinRoom, leaveRoom } = useWebSocket();

  // Join project room for real-time updates
  useEffect(() => {
    if (projectId && isConnected) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      joinRoom(`project:${projectId}`, user.id, user.name || 'User');

      return () => {
        leaveRoom(`project:${projectId}`);
      };
    }
  }, [projectId, isConnected, joinRoom, leaveRoom]);

  // Fetch stories
  const { data: stories = [], isLoading: storiesLoading } = useQuery({
    queryKey: ['stories', projectId],
    queryFn: () => storiesApi.getAll({ projectId }).then(res => res.data),
    enabled: !!projectId,
  });

  // Fetch epics for filtering
  const { data: epics = [] } = useQuery({
    queryKey: ['epics', projectId],
    queryFn: () => epicsApi.getAll(projectId).then(res => res.data),
    enabled: !!projectId,
  });

  // Fetch commits for selected story
  const { data: storyCommits = [] } = useQuery({
    queryKey: ['commits', selectedStory?.id],
    queryFn: () => selectedStory ? commitsApi.getByStory(selectedStory.id).then(res => res.data) : [],
    enabled: !!selectedStory,
  });

  // Fetch runs for selected story
  const { data: storyRuns = [] } = useQuery({
    queryKey: ['runs', selectedStory?.id],
    queryFn: () => selectedStory ? runsApi.getByStory(selectedStory.id).then(res => res.data) : [],
    enabled: !!selectedStory,
  });

  // Update story status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ storyId, status }: { storyId: string; status: StoryStatus }) =>
      storiesApi.updateStatus(storyId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
  });

  // Handle real-time story updates
  useStoryEvents({
    onStoryCreated: (event) => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
    onStoryUpdated: (event) => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      // Update selected story if it's the one that was updated
      if (selectedStory?.id === event.story.id) {
        setSelectedStory(event.story);
      }
    },
    onStoryStatusChanged: (event) => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
  });

  // Filter stories
  const filteredStories = useMemo(() => {
    let filtered = [...stories];

    if (selectedEpic !== 'all') {
      filtered = filtered.filter(s => s.epicId === selectedEpic);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(s => s.status === selectedStatus);
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter(s => s.type === selectedType);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        s =>
          s.key.toLowerCase().includes(query) ||
          s.title.toLowerCase().includes(query) ||
          s.description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [stories, selectedEpic, selectedStatus, selectedType, searchQuery]);

  const handleStatusChange = (storyId: string, newStatus: StoryStatus) => {
    updateStatusMutation.mutate({ storyId, status: newStatus });
  };

  const handleStoryClick = (story: Story) => {
    setSelectedStory(story);
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    // Small delay before clearing to allow drawer to close smoothly
    setTimeout(() => setSelectedStory(null), 300);
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">No Project Selected</h2>
          <p className="mt-2 text-gray-600">Please select a project to view the planning board.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Project Planning</h1>
            <p className="mt-1 text-sm text-gray-600">
              {filteredStories.length} stories
              {isConnected && (
                <span className="ml-2 inline-flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                  <span className="text-xs text-green-600">Live</span>
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4">
        <StoryFilters
          epics={epics}
          selectedEpic={selectedEpic}
          selectedStatus={selectedStatus}
          selectedType={selectedType}
          searchQuery={searchQuery}
          onEpicChange={setSelectedEpic}
          onStatusChange={setSelectedStatus}
          onTypeChange={setSelectedType}
          onSearchChange={setSearchQuery}
        />

        {/* Quick Filters */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Quick:</span>
          <button
            onClick={() => {
              const user = JSON.parse(localStorage.getItem('user') || '{}');
              setSearchQuery(user.name || '');
            }}
            className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors border border-blue-200"
          >
            👤 My Stories
          </button>
          <button
            onClick={() => setSelectedStatus('blocked')}
            className="px-3 py-1 text-sm bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-colors border border-red-200"
          >
            ⚠️ Blocked
          </button>
          <button
            onClick={() => setSearchQuery('no-component')}
            className="px-3 py-1 text-sm bg-yellow-50 text-yellow-700 rounded-md hover:bg-yellow-100 transition-colors border border-yellow-200"
          >
            🏷️ No Component
          </button>
          <button
            onClick={() => {
              // Filter to high priority (businessImpact >= 4)
              setSearchQuery('');
              setSelectedStatus('all');
              setSelectedType('all');
              setSelectedEpic('all');
            }}
            className="px-3 py-1 text-sm bg-purple-50 text-purple-700 rounded-md hover:bg-purple-100 transition-colors border border-purple-200"
          >
            ★★★★★ High Priority
          </button>
          {(selectedStatus !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedStatus('all');
                setSelectedType('all');
                setSelectedEpic('all');
              }}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden px-6 pb-4">
        {storiesLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading stories...</div>
          </div>
        ) : (
          <KanbanBoard
            stories={filteredStories}
            onStoryClick={handleStoryClick}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>

      {/* Story Detail Drawer */}
      <StoryDetailDrawer
        story={selectedStory}
        open={drawerOpen}
        onClose={handleDrawerClose}
        commits={storyCommits}
        runs={storyRuns}
      />
    </div>
  );
}
