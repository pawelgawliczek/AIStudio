import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { storiesService } from '../services/stories.service';
import { subtasksService } from '../services/subtasks.service';
import { useStoryEvents, useSubtaskEvents } from '../services/websocket.service';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { WorkflowAnalysisDisplay } from '../components/workflow/WorkflowAnalysisDisplay';
import { StoryTraceabilityTabs } from '../components/story/StoryTraceabilityTabs';
import { TokenMetricsPanel } from '../components/story/TokenMetricsPanel';
import type { Story, Subtask, SubtaskStatus, SubtaskLayer, CreateSubtaskDto, UpdateSubtaskDto } from '../types';
import { StoryStatus } from '../types';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-bg-secondary0/10 text-muted border-gray-500/20',
  analysis: 'bg-accent/100/10 text-accent border-accent/20',
  architecture: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  design: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  implementation: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  review: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  qa: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  done: 'bg-green-500/10 text-green-600 border-green-500/20',
};

const STATUS_TRANSITIONS: Record<string, StoryStatus[]> = {
  planning: [StoryStatus.ANALYSIS],
  analysis: [StoryStatus.PLANNING, StoryStatus.ARCHITECTURE],
  architecture: [StoryStatus.ANALYSIS, StoryStatus.DESIGN],
  design: [StoryStatus.ARCHITECTURE, StoryStatus.IMPLEMENTATION],
  implementation: [StoryStatus.DESIGN, StoryStatus.REVIEW],
  review: [StoryStatus.IMPLEMENTATION, StoryStatus.QA],
  qa: [StoryStatus.REVIEW, StoryStatus.DONE, StoryStatus.IMPLEMENTATION],
  done: [],
};

export function StoryDetailPage() {
  // Support both /story/:storyKey and legacy /projects/:projectId/stories/:storyId patterns
  const { storyKey, storyId: legacyStoryId, projectId } = useParams<{
    storyKey?: string;
    storyId?: string;
    projectId?: string;
  }>();
  const navigate = useNavigate();

  // Use storyKey if available, otherwise use legacy storyId
  const storyIdOrKey = storyKey || legacyStoryId;

  console.log('[StoryDetailPage] Component mounted, params:', { storyKey, legacyStoryId, projectId, storyIdOrKey });

  const [story, setStory] = useState<Story | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  console.log('[StoryDetailPage] State:', { story, subtasks, isLoading });
  const [showOverride, setShowOverride] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<StoryStatus>(StoryStatus.PLANNING);
  const [layerFilter, setLayerFilter] = useState<SubtaskLayer | ''>('');
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [editingSubtask, setEditingSubtask] = useState<string | null>(null);

  // New subtask form
  const [newSubtask, setNewSubtask] = useState<CreateSubtaskDto>({
    storyId: story?.id || '',
    title: '',
    description: '',
    layer: undefined,
    component: '',
  });

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser.role === 'admin';

  const loadStory = async () => {
    if (!storyIdOrKey || storyIdOrKey === 'new') {
      setIsLoading(false);  // Set loading to false for 'new' story creation
      return;
    }
    try {
      setIsLoading(true);
      console.log('[StoryDetailPage] Fetching story with idOrKey:', storyIdOrKey);
      // Use the new endpoint that supports both ID and storyKey
      const data = await storiesService.getById(storyIdOrKey);
      console.log('[StoryDetailPage] Story data received:', data);
      console.log('[StoryDetailPage] Complexity scores:', {
        businessComplexity: data.businessComplexity,
        technicalComplexity: data.technicalComplexity,
        businessImpact: data.businessImpact,
      });
      console.log('[StoryDetailPage] Traceability data:', {
        workflowRuns: data.workflowRuns?.length || 0,
        useCaseLinks: data.useCaseLinks?.length || 0,
        commits: data.commits?.length || 0,
      });
      setStory(data);
    } catch (error) {
      console.error('Failed to load story:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSubtasks = async () => {
    if (!story?.id) return;
    try {
      const data = await subtasksService.getAll({ storyId: story.id });
      setSubtasks(data);
    } catch (error) {
      console.error('Failed to load subtasks:', error);
    }
  };

  useEffect(() => {
    console.log('[StoryDetailPage] useEffect triggered, storyIdOrKey:', storyIdOrKey);
    loadStory();
  }, [storyIdOrKey]);

  useEffect(() => {
    if (story?.id) {
      loadSubtasks();
      // Update newSubtask storyId when story loads
      setNewSubtask(prev => ({ ...prev, storyId: story.id }));
    }
  }, [story?.id]);

  // Real-time updates
  useStoryEvents({
    onStoryUpdated: (data) => {
      if (data.story.id === story?.id) {
        setStory(data.story);
      }
    },
    onStoryStatusChanged: (data) => {
      if (data.storyId === story?.id) {
        setStory(prev => prev ? { ...prev, status: data.newStatus } : null);
      }
    },
  });

  useSubtaskEvents({
    onSubtaskCreated: (data) => {
      if (data.subtask.storyId === story?.id) {
        setSubtasks(prev => [...prev, data.subtask]);
      }
    },
    onSubtaskUpdated: (data) => {
      if (data.subtask.storyId === story?.id) {
        setSubtasks(prev => prev.map(s => s.id === data.subtask.id ? data.subtask : s));
      }
    },
  });

  const handleStatusTransition = async (newStatus: StoryStatus) => {
    if (!story?.id) return;
    try {
      await storiesService.updateStatus(story.id, { status: newStatus });
      loadStory();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update status');
    }
  };

  const handleOverrideStatus = async () => {
    if (!story?.id || !isAdmin) return;
    try {
      await storiesService.updateStatus(story.id, { status: overrideStatus });
      setShowOverride(false);
      loadStory();
    } catch (error) {
      alert('Failed to override status');
    }
  };

  const handleCreateSubtask = async () => {
    if (!newSubtask.title || !story?.id) return;
    try {
      await subtasksService.create({ ...newSubtask, storyId: story.id });
      setNewSubtask({ storyId: story.id, title: '', description: '', layer: undefined, component: '' });
      setShowAddSubtask(false);
      loadSubtasks();
    } catch (error) {
      alert('Failed to create subtask');
    }
  };

  const handleUpdateSubtask = async (subtaskId: string, data: UpdateSubtaskDto) => {
    try {
      await subtasksService.update(subtaskId, data);
      setEditingSubtask(null);
      loadSubtasks();
    } catch (error) {
      alert('Failed to update subtask');
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!confirm('Are you sure you want to delete this subtask?')) return;
    try {
      await subtasksService.delete(subtaskId);
      loadSubtasks();
    } catch (error) {
      alert('Failed to delete subtask');
    }
  };

  if (isLoading || !story) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
      </div>
    );
  }

  const availableTransitions = STATUS_TRANSITIONS[story.status] || [];
  const missingComplexity = !story.businessComplexity || !story.technicalComplexity || !story.businessImpact;

  // Filter and group subtasks
  const filteredSubtasks = layerFilter
    ? subtasks.filter(s => s.layer === layerFilter)
    : subtasks;

  const groupedSubtasks: Record<SubtaskStatus, Subtask[]> = {
    todo: [],
    in_progress: [],
    review: [],
    done: [],
  };

  filteredSubtasks.forEach(subtask => {
    groupedSubtasks[subtask.status].push(subtask);
  });

  return (
    <div data-testid="story-detail">
      <div className="mb-6">
        <Breadcrumbs
          items={[
            { name: 'Stories', href: '/epic-planning', testId: 'breadcrumb-stories' },
            { name: story.key, testId: 'breadcrumb-story' },
          ]}
        />
      </div>

      {/* Story Header */}
      <div className="bg-card border border-border rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="text-sm font-mono text-muted">{story.key}</span>
              <span
                data-testid="current-status"
                className={clsx(
                  'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border',
                  STATUS_COLORS[story.status]
                )}
              >
                {story.status}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200">
                {story.type}
              </span>
              {story.epic && (
                <span className="text-xs text-muted">{story.epic.key}</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-fg mb-2">{story.title}</h1>
            {story.description && (
              <div className="text-muted prose prose-sm max-w-none prose-headings:text-fg prose-p:text-muted prose-strong:text-fg prose-code:text-fg prose-pre:bg-bg-secondary">
                <ReactMarkdown>{story.description}</ReactMarkdown>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate(`/epic-planning?editStory=${story.key}`)}
            className="ml-4 px-4 py-2 rounded-md font-semibold bg-accent text-accent-fg hover:bg-accent-dark shadow-sm hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring text-sm inline-flex items-center"
          >
            <PencilIcon className="h-4 w-4 mr-1" />
            Edit
          </button>
        </div>

        {/* Complexity Warning */}
        {missingComplexity && story.status === 'design' && (
          <div
            data-testid="complexity-warning"
            className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4"
          >
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Story must have complexity fields set before moving to implementation
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Status Transitions */}
        <div className="flex flex-wrap gap-2 mb-4">
          {availableTransitions.map(nextStatus => (
            <button
              key={nextStatus}
              data-testid={`move-to-${nextStatus}`}
              onClick={() => handleStatusTransition(nextStatus)}
              className="px-4 py-2 rounded-md font-semibold bg-accent text-accent-fg hover:bg-accent-dark shadow-sm hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring text-sm"
            >
              Move to {nextStatus}
            </button>
          ))}

          {isAdmin && (
            <button
              data-testid="override-status"
              onClick={() => setShowOverride(!showOverride)}
              className="px-4 py-2 rounded-md font-semibold bg-red-600 text-white hover:bg-red-700 shadow-sm hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring text-sm"
            >
              Admin Override
            </button>
          )}
        </div>

        {/* Override Form */}
        {showOverride && isAdmin && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <label className="block text-sm font-medium text-fg mb-2">
              Override Status
            </label>
            <div className="flex gap-2">
              <select
                data-testid="status-select"
                value={overrideStatus}
                onChange={(e) => setOverrideStatus(e.target.value as StoryStatus)}
                className="flex-1 px-4 py-3 bg-bg-secondary border border-border rounded-lg text-fg focus:border-red-500 focus:ring-2 focus:ring-red-500 transition-colors"
              >
                <option value="planning">Planning</option>
                <option value="analysis">Analysis</option>
                <option value="architecture">Architecture</option>
                <option value="design">Design</option>
                <option value="implementation">Implementation</option>
                <option value="review">Review</option>
                <option value="qa">QA</option>
                <option value="done">Done</option>
              </select>
              <button
                data-testid="confirm-override"
                onClick={handleOverrideStatus}
                className="px-4 py-2 rounded-md font-semibold bg-red-600 text-white hover:bg-red-700 shadow-sm hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
              >
                Confirm
              </button>
            </div>
          </div>
        )}

        {/* Story Details */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
          <div>
            <span className="text-sm text-muted">Technical Complexity</span>
            <p className="text-lg font-medium text-fg">{story.technicalComplexity || 'Not set'}</p>
          </div>
          <div>
            <span className="text-sm text-muted">Business Impact</span>
            <p className="text-lg font-medium text-fg">{story.businessImpact || 'Not set'}</p>
          </div>
          <div>
            <span className="text-sm text-muted">Business Complexity</span>
            <p className="text-lg font-medium text-fg">{story.businessComplexity || 'Not set'}</p>
          </div>
        </div>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Workflow Analysis Section */}
          <WorkflowAnalysisDisplay story={story} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Traceability Section */}
          <StoryTraceabilityTabs
            workflowRuns={(story as any).workflowRuns}
            useCaseLinks={(story as any).useCaseLinks}
            commits={(story as any).commits}
          />
        </div>
      </div>

      {/* Token Metrics Section - Full Width */}
      {story?.id && (
        <div className="mb-6">
          <TokenMetricsPanel storyId={story.id} />
        </div>
      )}

      {/* Subtasks Section - Hidden */}
      {false && (
        <div className="bg-card border border-border rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-fg">Subtasks</h2>
          <div className="flex gap-2">
            <select
              data-testid="filter-layer"
              value={layerFilter}
              onChange={(e) => setLayerFilter(e.target.value as SubtaskLayer | '')}
              className="px-4 py-3 bg-bg-secondary border border-border rounded-lg text-fg focus:border-accent focus:ring-2 focus:ring-ring transition-colors text-sm"
            >
              <option value="">All layers</option>
              <option value="frontend">Frontend</option>
              <option value="backend">Backend</option>
              <option value="tests">Tests</option>
              <option value="docs">Docs</option>
              <option value="infra">Infra</option>
            </select>
            <button
              data-testid="add-subtask"
              onClick={() => setShowAddSubtask(true)}
              className="px-4 py-2 rounded-md font-semibold bg-accent text-accent-fg hover:bg-accent-dark shadow-sm hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring text-sm inline-flex items-center"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Subtask
            </button>
          </div>
        </div>

        {/* Add Subtask Form */}
        {showAddSubtask && (
          <div className="bg-bg-secondary border border-border rounded-md p-4 mb-4">
            <input
              data-testid="subtask-title"
              type="text"
              placeholder="Subtask title"
              value={newSubtask.title}
              onChange={(e) => setNewSubtask({ ...newSubtask, title: e.target.value })}
              className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-lg text-fg focus:border-accent focus:ring-2 focus:ring-ring transition-colors mb-2"
            />
            <textarea
              data-testid="subtask-description"
              placeholder="Description"
              value={newSubtask.description}
              onChange={(e) => setNewSubtask({ ...newSubtask, description: e.target.value })}
              className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-lg text-fg focus:border-accent focus:ring-2 focus:ring-ring transition-colors mb-2"
              rows={2}
            />
            <div className="flex gap-2 mb-2">
              <select
                data-testid="subtask-layer"
                value={newSubtask.layer || ''}
                onChange={(e) => setNewSubtask({ ...newSubtask, layer: e.target.value as SubtaskLayer | undefined })}
                className="flex-1 px-4 py-3 bg-bg-secondary border border-border rounded-lg text-fg focus:border-accent focus:ring-2 focus:ring-ring transition-colors"
              >
                <option value="">Select layer</option>
                <option value="frontend">Frontend</option>
                <option value="backend">Backend</option>
                <option value="tests">Tests</option>
                <option value="docs">Docs</option>
                <option value="infra">Infra</option>
              </select>
              <input
                data-testid="subtask-component"
                type="text"
                placeholder="Component"
                value={newSubtask.component}
                onChange={(e) => setNewSubtask({ ...newSubtask, component: e.target.value })}
                className="flex-1 px-4 py-3 bg-bg-secondary border border-border rounded-lg text-fg focus:border-accent focus:ring-2 focus:ring-ring transition-colors"
              />
            </div>
            <div className="flex gap-2">
              <button
                data-testid="save-subtask"
                onClick={handleCreateSubtask}
                className="px-4 py-2 rounded-md font-semibold bg-accent text-accent-fg hover:bg-accent-dark shadow-sm hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring text-sm"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowAddSubtask(false);
                  setNewSubtask({ storyId: story?.id || '', title: '', description: '', layer: undefined, component: '' });
                }}
                className="px-4 py-2 rounded-md font-semibold bg-bg-secondary text-fg hover:bg-muted shadow-sm hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Subtasks by Status */}
        <div className="space-y-6">
          {(['todo', 'in_progress', 'review', 'done'] as SubtaskStatus[]).map(status => (
            <div key={status} data-testid={`status-group-${status}`}>
              <h3 className="text-sm font-medium text-fg mb-2 capitalize">
                {status.replace('_', ' ')} ({groupedSubtasks[status].length})
              </h3>
              <div className="space-y-2">
                {groupedSubtasks[status].map(subtask => (
                  <div
                    key={subtask.id}
                    data-testid={`subtask-${subtask.id}`}
                    className="bg-card border border-border rounded-md p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-fg">{subtask.title}</h4>
                        {subtask.description && (
                          <p className="text-sm text-muted mt-1">{subtask.description}</p>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-muted">
                          {subtask.layer && <span>Layer: {subtask.layer}</span>}
                          {subtask.component && <span>Component: {subtask.component}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <select
                          data-testid="status-dropdown"
                          value={subtask.status}
                          onChange={(e) => handleUpdateSubtask(subtask.id, { status: e.target.value as SubtaskStatus })}
                          className="text-xs px-4 py-3 bg-bg-secondary border border-border rounded-lg text-fg focus:border-accent focus:ring-2 focus:ring-ring transition-colors"
                        >
                          <option value="todo">Todo</option>
                          <option value="in_progress">In Progress</option>
                          <option value="review">Review</option>
                          <option value="done">Done</option>
                        </select>
                        <button
                          data-testid={`edit-subtask-${subtask.id}`}
                          className="text-accent hover:text-accent-dark"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          data-testid={`delete-subtask-${subtask.id}`}
                          onClick={() => handleDeleteSubtask(subtask.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {groupedSubtasks[status].length === 0 && (
                  <p className="text-sm text-muted italic">No subtasks</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
