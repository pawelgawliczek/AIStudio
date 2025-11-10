import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storiesService } from '../services/stories.service';
import { subtasksService } from '../services/subtasks.service';
import { useStoryEvents, useSubtaskEvents } from '../services/websocket.service';
import { Breadcrumbs } from '../components/Breadcrumbs';
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
  planning: 'bg-gray-100 text-gray-800',
  analysis: 'bg-blue-100 text-blue-800',
  architecture: 'bg-purple-100 text-purple-800',
  design: 'bg-pink-100 text-pink-800',
  implementation: 'bg-yellow-100 text-yellow-800',
  review: 'bg-orange-100 text-orange-800',
  qa: 'bg-indigo-100 text-indigo-800',
  done: 'bg-green-100 text-green-800',
};

const STATUS_TRANSITIONS: Record<string, StoryStatus[]> = {
  planning: [StoryStatus.analysis],
  analysis: [StoryStatus.planning, StoryStatus.architecture],
  architecture: [StoryStatus.analysis, StoryStatus.design],
  design: [StoryStatus.architecture, StoryStatus.implementation],
  implementation: [StoryStatus.design, StoryStatus.review],
  review: [StoryStatus.implementation, StoryStatus.qa],
  qa: [StoryStatus.review, StoryStatus.done, StoryStatus.implementation],
  done: [],
};

export function StoryDetailPage() {
  const { projectId, storyId } = useParams<{ projectId: string; storyId: string }>();
  const navigate = useNavigate();

  const [story, setStory] = useState<Story | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<StoryStatus>(StoryStatus.planning);
  const [layerFilter, setLayerFilter] = useState<SubtaskLayer | ''>('');
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [editingSubtask, setEditingSubtask] = useState<string | null>(null);

  // New subtask form
  const [newSubtask, setNewSubtask] = useState<CreateSubtaskDto>({
    storyId: storyId!,
    title: '',
    description: '',
    layer: undefined,
    component: '',
  });

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser.role === 'admin';

  const loadStory = async () => {
    if (!storyId) return;
    try {
      setIsLoading(true);
      const data = await storiesService.getById(storyId);
      setStory(data);
    } catch (error) {
      console.error('Failed to load story:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSubtasks = async () => {
    if (!storyId) return;
    try {
      const data = await subtasksService.getAll({ storyId });
      setSubtasks(data);
    } catch (error) {
      console.error('Failed to load subtasks:', error);
    }
  };

  useEffect(() => {
    loadStory();
    loadSubtasks();
  }, [storyId]);

  // Real-time updates
  useStoryEvents({
    onStoryUpdated: (data) => {
      if (data.story.id === storyId) {
        setStory(data.story);
      }
    },
    onStoryStatusChanged: (data) => {
      if (data.storyId === storyId) {
        setStory(prev => prev ? { ...prev, status: data.newStatus } : null);
      }
    },
  });

  useSubtaskEvents({
    onSubtaskCreated: (data) => {
      if (data.subtask.storyId === storyId) {
        setSubtasks(prev => [...prev, data.subtask]);
      }
    },
    onSubtaskUpdated: (data) => {
      if (data.subtask.storyId === storyId) {
        setSubtasks(prev => prev.map(s => s.id === data.subtask.id ? data.subtask : s));
      }
    },
  });

  const handleStatusTransition = async (newStatus: StoryStatus) => {
    if (!storyId) return;
    try {
      await storiesService.updateStatus(storyId, { status: newStatus });
      loadStory();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update status');
    }
  };

  const handleOverrideStatus = async () => {
    if (!storyId || !isAdmin) return;
    try {
      await storiesService.updateStatus(storyId, { status: overrideStatus });
      setShowOverride(false);
      loadStory();
    } catch (error) {
      alert('Failed to override status');
    }
  };

  const handleCreateSubtask = async () => {
    if (!newSubtask.title || !storyId) return;
    try {
      await subtasksService.create({ ...newSubtask, storyId });
      setNewSubtask({ storyId, title: '', description: '', layer: undefined, component: '' });
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
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
            { name: 'Stories', href: `/projects/${projectId}/stories`, testId: 'breadcrumb-stories' },
            { name: story.key, testId: 'breadcrumb-story' },
          ]}
        />
      </div>

      {/* Story Header */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-mono text-gray-500">{story.key}</span>
              <span
                data-testid="current-status"
                className={clsx(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  STATUS_COLORS[story.status]
                )}
              >
                {story.status}
              </span>
              {story.epic && (
                <span className="text-xs text-gray-500">{story.epic.key}</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{story.title}</h1>
            {story.description && (
              <p className="text-gray-600">{story.description}</p>
            )}
          </div>
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
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
            >
              Move to {nextStatus}
            </button>
          ))}

          {isAdmin && (
            <button
              data-testid="override-status"
              onClick={() => setShowOverride(!showOverride)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
            >
              Admin Override
            </button>
          )}
        </div>

        {/* Override Form */}
        {showOverride && isAdmin && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Override Status
            </label>
            <div className="flex gap-2">
              <select
                data-testid="status-select"
                value={overrideStatus}
                onChange={(e) => setOverrideStatus(e.target.value as StoryStatus)}
                className="flex-1 rounded-md border-gray-300 focus:border-red-500 focus:ring-red-500"
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
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Confirm
              </button>
            </div>
          </div>
        )}

        {/* Story Details */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div>
            <span className="text-sm text-gray-500">Technical Complexity</span>
            <p className="text-lg font-medium">{story.technicalComplexity || 'Not set'}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Business Impact</span>
            <p className="text-lg font-medium">{story.businessImpact || 'Not set'}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Business Complexity</span>
            <p className="text-lg font-medium">{story.businessComplexity || 'Not set'}</p>
          </div>
        </div>
      </div>

      {/* Subtasks Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Subtasks</h2>
          <div className="flex gap-2">
            <select
              data-testid="filter-layer"
              value={layerFilter}
              onChange={(e) => setLayerFilter(e.target.value as SubtaskLayer | '')}
              className="rounded-md border-gray-300 text-sm"
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
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium inline-flex items-center"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Subtask
            </button>
          </div>
        </div>

        {/* Add Subtask Form */}
        {showAddSubtask && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-4">
            <input
              data-testid="subtask-title"
              type="text"
              placeholder="Subtask title"
              value={newSubtask.title}
              onChange={(e) => setNewSubtask({ ...newSubtask, title: e.target.value })}
              className="w-full rounded-md border-gray-300 mb-2"
            />
            <textarea
              data-testid="subtask-description"
              placeholder="Description"
              value={newSubtask.description}
              onChange={(e) => setNewSubtask({ ...newSubtask, description: e.target.value })}
              className="w-full rounded-md border-gray-300 mb-2"
              rows={2}
            />
            <div className="flex gap-2 mb-2">
              <select
                data-testid="subtask-layer"
                value={newSubtask.layer || ''}
                onChange={(e) => setNewSubtask({ ...newSubtask, layer: e.target.value as SubtaskLayer | undefined })}
                className="flex-1 rounded-md border-gray-300"
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
                className="flex-1 rounded-md border-gray-300"
              />
            </div>
            <div className="flex gap-2">
              <button
                data-testid="save-subtask"
                onClick={handleCreateSubtask}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowAddSubtask(false);
                  setNewSubtask({ storyId: storyId!, title: '', description: '', layer: undefined, component: '' });
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
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
              <h3 className="text-sm font-medium text-gray-700 mb-2 capitalize">
                {status.replace('_', ' ')} ({groupedSubtasks[status].length})
              </h3>
              <div className="space-y-2">
                {groupedSubtasks[status].map(subtask => (
                  <div
                    key={subtask.id}
                    data-testid={`subtask-${subtask.id}`}
                    className="bg-white border border-gray-200 rounded-md p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{subtask.title}</h4>
                        {subtask.description && (
                          <p className="text-sm text-gray-600 mt-1">{subtask.description}</p>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                          {subtask.layer && <span>Layer: {subtask.layer}</span>}
                          {subtask.component && <span>Component: {subtask.component}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <select
                          data-testid="status-dropdown"
                          value={subtask.status}
                          onChange={(e) => handleUpdateSubtask(subtask.id, { status: e.target.value as SubtaskStatus })}
                          className="text-xs rounded border-gray-300"
                        >
                          <option value="todo">Todo</option>
                          <option value="in_progress">In Progress</option>
                          <option value="review">Review</option>
                          <option value="done">Done</option>
                        </select>
                        <button
                          data-testid={`edit-subtask-${subtask.id}`}
                          className="text-indigo-600 hover:text-indigo-700"
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
                  <p className="text-sm text-gray-400 italic">No subtasks</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
