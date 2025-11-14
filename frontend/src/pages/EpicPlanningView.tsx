import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCorners,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
} from '@dnd-kit/core';
import { Story, Epic, StoryStatus, StoryType, PlanningOverview } from '../types';
import { storiesApi, epicsApi } from '../services/api';
import { EpicGroup } from '../components/planning/EpicGroup';
import { PlanningFilters } from '../components/planning/PlanningFilters';
import { PlanningItemCard } from '../components/planning/PlanningItemCard';
import { StoryDetailDrawer } from '../components/StoryDetailDrawer';
import { CreateStoryModal } from '../components/CreateStoryModal';
import { CreateEpicModal } from '../components/CreateEpicModal';
import { useWebSocket, useStoryEvents, useEpicEvents } from '../services/websocket.service';
import { useProject } from '../context/ProjectContext';

type ViewMode = 'grouped' | 'flat';
type SortOption = 'priority-high' | 'priority-low' | 'created-new' | 'created-old' | 'updated' | 'title-az' | 'title-za';

export function EpicPlanningView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id || '';

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [sortOption, setSortOption] = useState<SortOption>('priority-high');

  // Filter state (from URL params)
  const statusFilter = searchParams.get('status')?.split(',') || [];
  const typeFilter = searchParams.get('type')?.split(',') || [];
  const epicFilter = searchParams.get('epic')?.split(',') || [];
  const searchQuery = searchParams.get('search') || '';

  // Modal/drawer state
  const [selectedItem, setSelectedItem] = useState<Story | Epic | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalEpicId, setCreateModalEpicId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [showEditEpicModal, setShowEditEpicModal] = useState(false);
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null);

  // Epic collapse state (track which epics are collapsed, all others are expanded by default)
  const [collapsedEpics, setCollapsedEpics] = useState<Set<string>>(new Set());

  // Hide completed items state (with sessionStorage persistence)
  const [hideCompletedItems, setHideCompletedItems] = useState<boolean>(() => {
    const stored = sessionStorage.getItem('hideCompletedItems');
    return stored === null ? true : stored === 'true';
  });

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDragItem, setActiveDragItem] = useState<Story | Epic | null>(null);

  const queryClient = useQueryClient();
  const { isConnected, joinRoom, leaveRoom } = useWebSocket();

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

  // Fetch planning overview
  const { data: planningData, isLoading } = useQuery<PlanningOverview>({
    queryKey: ['planning-overview', projectId],
    queryFn: () => epicsApi.getPlanningOverview(projectId).then(res => res.data),
    enabled: !!projectId,
  });

  // Update epic priority mutation
  const updateEpicPriorityMutation = useMutation({
    mutationFn: ({ epicId, priority }: { epicId: string; priority: number }) =>
      epicsApi.updatePriority(epicId, priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-overview'] });
    },
  });

  // Update story priority mutation
  const updateStoryPriorityMutation = useMutation({
    mutationFn: ({ storyId, priority }: { storyId: string; priority: number }) =>
      storiesApi.updatePriority(storyId, priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-overview'] });
    },
  });

  // Reassign story to epic mutation
  const reassignStoryMutation = useMutation({
    mutationFn: ({ storyId, epicId, priority }: { storyId: string; epicId: string | null; priority?: number }) =>
      storiesApi.reassignEpic(storyId, epicId, priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-overview'] });
    },
  });

  // Handle real-time updates
  useStoryEvents({
    onStoryCreated: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-overview'] });
    },
    onStoryUpdated: (event) => {
      queryClient.invalidateQueries({ queryKey: ['planning-overview'] });
      if (selectedItem && 'status' in selectedItem && selectedItem.id === event.story.id) {
        setSelectedItem(event.story);
      }
    },
    onStoryStatusChanged: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-overview'] });
    },
  });

  useEpicEvents({
    onEpicCreated: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-overview'] });
    },
    onEpicUpdated: (event) => {
      queryClient.invalidateQueries({ queryKey: ['planning-overview'] });
      if (selectedItem && 'priority' in selectedItem && selectedItem.id === event.epic.id) {
        setSelectedItem(event.epic);
      }
    },
  });

  // Filter and sort logic
  const filteredAndSortedData = useMemo(() => {
    if (!planningData) return { epics: [], unassignedStories: [] };

    let epics = [...planningData.epics];
    let unassignedStories = [...planningData.unassignedStories];

    // Apply filters
    const filterStories = (stories: Story[]) => {
      return stories.filter(story => {
        // Hide completed items filter
        if (hideCompletedItems && story.status === 'done') {
          return false;
        }

        // Status filter
        if (statusFilter.length > 0 && !statusFilter.includes(story.status)) {
          return false;
        }

        // Type filter
        if (typeFilter.length > 0 && !typeFilter.includes(story.type)) {
          return false;
        }

        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesSearch =
            story.key.toLowerCase().includes(query) ||
            story.title.toLowerCase().includes(query) ||
            story.description?.toLowerCase().includes(query);
          if (!matchesSearch) return false;
        }

        return true;
      });
    };

    // Filter stories within epics
    epics = epics.map(epic => ({
      ...epic,
      stories: filterStories(epic.stories || []),
    }));

    // Filter by epic
    if (epicFilter.length > 0) {
      epics = epics.filter(epic => epicFilter.includes(epic.id));
      unassignedStories = [];
    } else {
      unassignedStories = filterStories(unassignedStories);
    }

    // Sort logic
    const sortStories = (stories: Story[]) => {
      return [...stories].sort((a, b) => {
        switch (sortOption) {
          case 'priority-high':
            return (b.businessImpact || 0) - (a.businessImpact || 0);
          case 'priority-low':
            return (a.businessImpact || 0) - (b.businessImpact || 0);
          case 'created-new':
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case 'created-old':
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case 'updated':
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          case 'title-az':
            return a.title.localeCompare(b.title);
          case 'title-za':
            return b.title.localeCompare(a.title);
          default:
            return 0;
        }
      });
    };

    epics = epics.map(epic => ({
      ...epic,
      stories: sortStories(epic.stories || []),
    }));

    unassignedStories = sortStories(unassignedStories);

    return { epics, unassignedStories };
  }, [planningData, statusFilter, typeFilter, epicFilter, searchQuery, sortOption, hideCompletedItems]);

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    // Find the dragged item
    const allStories = [
      ...filteredAndSortedData.epics.flatMap(e => e.stories || []),
      ...filteredAndSortedData.unassignedStories,
    ];
    const draggedStory = allStories.find(s => s.id === active.id);
    const draggedEpic = filteredAndSortedData.epics.find(e => e.id === active.id);

    setActiveDragItem(draggedStory || draggedEpic || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setActiveDragItem(null);

    if (!over || active.id === over.id) return;

    // Handle epic reordering
    if (activeDragItem && 'priority' in activeDragItem && !('status' in activeDragItem)) {
      // This is an epic being dragged
      const activeEpic = activeDragItem as Epic;
      const overEpic = filteredAndSortedData.epics.find(e => e.id === over.id);

      if (overEpic) {
        // Swap priorities
        updateEpicPriorityMutation.mutate({ epicId: activeEpic.id, priority: overEpic.priority });
        updateEpicPriorityMutation.mutate({ epicId: overEpic.id, priority: activeEpic.priority });
      }
    }
    // Handle story reordering or reassignment
    else if (activeDragItem && 'status' in activeDragItem) {
      const activeStory = activeDragItem as Story;

      // Check if dropped on an epic (for reassignment)
      const targetEpic = filteredAndSortedData.epics.find(e => e.id === over.id);
      if (targetEpic) {
        // Reassign to different epic
        const newPriority = Math.max(...(targetEpic.stories?.map(s => s.businessImpact || 0) || [0])) + 1;
        reassignStoryMutation.mutate({
          storyId: activeStory.id,
          epicId: targetEpic.id,
          priority: newPriority
        });
        return;
      }

      // Check if dropped on unassigned area
      if (over.id === 'unassigned') {
        reassignStoryMutation.mutate({
          storyId: activeStory.id,
          epicId: null
        });
        return;
      }

      // Otherwise, it's story reordering within same epic
      const allStories = [
        ...filteredAndSortedData.epics.flatMap(e => e.stories || []),
        ...filteredAndSortedData.unassignedStories,
      ];
      const overStory = allStories.find(s => s.id === over.id);

      if (overStory && activeStory.epicId === overStory.epicId) {
        // Swap priorities within same epic
        updateStoryPriorityMutation.mutate({ storyId: activeStory.id, priority: overStory.businessImpact || 0 });
        updateStoryPriorityMutation.mutate({ storyId: overStory.id, priority: activeStory.businessImpact || 0 });
      }
    }
  };

  const handleItemClick = (item: Story | Epic) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setTimeout(() => setSelectedItem(null), 300);
  };

  const handleAddStory = (epicId: string | null) => {
    setCreateModalEpicId(epicId);
    setShowCreateModal(true);
  };

  const handleCreateStory = async (data: any) => {
    if (!projectId) return;
    try {
      setIsCreating(true);
      await storiesApi.create({ ...data, projectId, epicId: createModalEpicId });
      setShowCreateModal(false);
      queryClient.invalidateQueries({ queryKey: ['planning-overview'] });
    } catch (error) {
      console.error('Failed to create story:', error);
      alert('Failed to create story');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditStory = (story: Story) => {
    setEditingStory(story);
    setDrawerOpen(false);
    setShowEditModal(true);
  };

  const handleUpdateStory = async (data: any) => {
    if (!editingStory) return;
    try {
      setIsCreating(true);
      await storiesApi.update(editingStory.id, data);
      setShowEditModal(false);
      setEditingStory(null);
      queryClient.invalidateQueries({ queryKey: ['planning-overview'] });
    } catch (error) {
      console.error('Failed to update story:', error);
      alert('Failed to update story');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditEpic = (epic: Epic) => {
    setEditingEpic(epic);
    setShowEditEpicModal(true);
  };

  const handleUpdateEpic = async (data: any) => {
    if (!editingEpic) return;
    try {
      setIsCreating(true);
      await epicsApi.update(editingEpic.id, data);
      setShowEditEpicModal(false);
      setEditingEpic(null);
      queryClient.invalidateQueries({ queryKey: ['planning-overview'] });
    } catch (error) {
      console.error('Failed to update epic:', error);
      alert('Failed to update epic');
    } finally {
      setIsCreating(false);
    }
  };

  const toggleEpicExpansion = (epicId: string) => {
    setCollapsedEpics(prev => {
      const next = new Set(prev);
      if (next.has(epicId)) {
        // Currently collapsed, so expand it (remove from set)
        next.delete(epicId);
      } else {
        // Currently expanded, so collapse it (add to set)
        next.add(epicId);
      }
      return next;
    });
  };

  const toggleHideCompletedItems = () => {
    setHideCompletedItems(prev => {
      const newValue = !prev;
      sessionStorage.setItem('hideCompletedItems', String(newValue));
      return newValue;
    });
  };

  const updateFilter = (key: string, value: string[]) => {
    const newParams = new URLSearchParams(searchParams);
    if (value.length > 0) {
      newParams.set(key, value.join(','));
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const updateSearch = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set('search', value);
    } else {
      newParams.delete('search');
    }
    setSearchParams(newParams);
  };

  const clearAllFilters = () => {
    setSearchParams({ projectId });
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-fg">No Project Selected</h2>
          <p className="mt-2 text-muted">Please select a project to view the epic planning.</p>
        </div>
      </div>
    );
  }

  const hasActiveFilters = statusFilter.length > 0 || typeFilter.length > 0 ||
                          epicFilter.length > 0 || searchQuery;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="bg-card shadow-sm px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-fg">Epic Planning</h1>
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-muted rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grouped')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'grouped'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-fg'
                  }`}
                >
                  Grouped by Epics
                </button>
                <button
                  onClick={() => setViewMode('flat')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'flat'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-fg'
                  }`}
                >
                  Flat View
                </button>
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="px-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="priority-high">Priority: High to Low</option>
                <option value="priority-low">Priority: Low to High</option>
                <option value="created-new">Created: Newest First</option>
                <option value="created-old">Created: Oldest First</option>
                <option value="updated">Recently Updated</option>
                <option value="title-az">Title: A-Z</option>
                <option value="title-za">Title: Z-A</option>
              </select>

              {/* Show/Hide Completed Toggle */}
              <button
                onClick={toggleHideCompletedItems}
                className="px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
              >
                {hideCompletedItems ? 'Show Completed' : 'Hide Completed'}
              </button>

              {/* Filters */}
              <PlanningFilters
                statusFilter={statusFilter}
                typeFilter={typeFilter}
                epicFilter={epicFilter}
                searchQuery={searchQuery}
                epics={planningData?.epics || []}
                onStatusChange={(value) => updateFilter('status', value)}
                onTypeChange={(value) => updateFilter('type', value)}
                onEpicChange={(value) => updateFilter('epic', value)}
                onSearchChange={updateSearch}
              />
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Filters:</span>
              {statusFilter.length > 0 && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                  Status: {statusFilter.join(', ')}
                </span>
              )}
              {typeFilter.length > 0 && (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                  Type: {typeFilter.join(', ')}
                </span>
              )}
              {epicFilter.length > 0 && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                  Epic: {epicFilter.length} selected
                </span>
              )}
              {searchQuery && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                  Search: "{searchQuery}"
                </span>
              )}
              <button
                onClick={clearAllFilters}
                className="ml-2 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-2 text-muted-foreground">Loading planning data...</p>
              </div>
            </div>
          ) : (
            <>
              {viewMode === 'grouped' ? (
                <div className="space-y-6">
                  {filteredAndSortedData.epics.map((epic) => (
                    <EpicGroup
                      key={epic.id}
                      epic={epic}
                      onEpicClick={handleEditEpic}
                      onStoryClick={handleItemClick}
                      onAddStory={handleAddStory}
                      isExpanded={!collapsedEpics.has(epic.id)}
                      onToggleExpand={() => toggleEpicExpansion(epic.id)}
                      hideCompletedItems={hideCompletedItems}
                    />
                  ))}

                  {/* Unassigned Stories */}
                  {filteredAndSortedData.unassignedStories.length > 0 && (
                    <EpicGroup
                      epic={null}
                      stories={filteredAndSortedData.unassignedStories}
                      onStoryClick={handleItemClick}
                      onAddStory={handleAddStory}
                      hideCompletedItems={hideCompletedItems}
                    />
                  )}

                  {filteredAndSortedData.epics.length === 0 && filteredAndSortedData.unassignedStories.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No items match the current filters.</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Flat View */
                <div className="space-y-2">
                  {[
                    ...filteredAndSortedData.epics.flatMap(e => e.stories || []),
                    ...filteredAndSortedData.unassignedStories,
                  ].map((story) => (
                    <PlanningItemCard
                      key={story.id}
                      item={story}
                      onClick={handleItemClick}
                      showEpicBadge={true}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeDragItem && (
            <div className="opacity-90 rotate-3">
              <PlanningItemCard item={activeDragItem} onClick={() => {}} />
            </div>
          )}
        </DragOverlay>

        {/* Detail Drawer - Only show for Stories (check for 'type' property) */}
        {selectedItem && 'type' in selectedItem && (
          <StoryDetailDrawer
            story={selectedItem as Story}
            open={drawerOpen}
            onClose={handleDrawerClose}
            onEdit={handleEditStory}
          />
        )}

        {/* Create Story Modal */}
        <CreateStoryModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateStory}
          epics={planningData?.epics || []}
          projectId={projectId}
          isLoading={isCreating}
        />

        {/* Edit Story Modal */}
        {editingStory && (
          <CreateStoryModal
            open={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setEditingStory(null);
            }}
            onSubmit={handleUpdateStory}
            epics={planningData?.epics || []}
            projectId={projectId}
            isLoading={isCreating}
            initialData={{
              title: editingStory.title,
              description: editingStory.description || '',
              type: editingStory.type,
              epicId: editingStory.epicId || undefined,
              technicalComplexity: editingStory.technicalComplexity,
              businessImpact: editingStory.businessImpact,
              businessComplexity: editingStory.businessComplexity,
            }}
          />
        )}

        {/* Edit Epic Modal */}
        {editingEpic && (
          <CreateEpicModal
            open={showEditEpicModal}
            onClose={() => {
              setShowEditEpicModal(false);
              setEditingEpic(null);
            }}
            onSubmit={handleUpdateEpic}
            isLoading={isCreating}
            initialData={{
              title: editingEpic.title,
              description: editingEpic.description || '',
              priority: editingEpic.priority,
            }}
          />
        )}
      </div>
    </DndContext>
  );
}
