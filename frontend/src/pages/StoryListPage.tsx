import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { storiesService } from '../services/stories.service';
import { epicsService } from '../services/epics.service';
import { useStoryEvents } from '../services/websocket.service';
import { useProject } from '../context/ProjectContext';
import { Breadcrumbs } from '../components/Breadcrumbs';
import type { Story, Epic, StoryStatus, StoryType, FilterStoryDto } from '../types';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  FunnelIcon,
  XMarkIcon,
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

export function StoryListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedProject } = useProject();
  const navigate = useNavigate();

  const [stories, setStories] = useState<Story[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StoryStatus | ''>('');
  const [epicFilter, setEpicFilter] = useState('');
  const [minComplexity, setMinComplexity] = useState<number | ''>('');
  const [maxComplexity, setMaxComplexity] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const limit = 20;

  const loadStories = async () => {
    if (!projectId) return;

    try {
      setIsLoading(true);
      const filters: FilterStoryDto = {
        projectId,
        page: currentPage,
        limit,
        sortBy,
        sortOrder,
      };

      if (search) filters.search = search;
      if (statusFilter) filters.status = statusFilter;
      if (epicFilter) filters.epicId = epicFilter;
      if (minComplexity !== '') filters.minTechnicalComplexity = Number(minComplexity);
      if (maxComplexity !== '') filters.maxTechnicalComplexity = Number(maxComplexity);

      const response = await storiesService.getAll(filters);
      setStories(response.data);
      setTotal(response.meta.total);
    } catch (error) {
      console.error('Failed to load stories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEpics = async () => {
    if (!projectId) return;
    try {
      const data = await epicsService.getAll({ projectId });
      setEpics(data);
    } catch (error) {
      console.error('Failed to load epics:', error);
    }
  };

  useEffect(() => {
    loadStories();
  }, [projectId, currentPage, statusFilter, epicFilter, minComplexity, maxComplexity, sortBy, sortOrder]);

  useEffect(() => {
    loadEpics();
  }, [projectId]);

  // Handle real-time updates
  useStoryEvents({
    onStoryCreated: (data) => {
      if (data.story.projectId === projectId) {
        loadStories(); // Reload to maintain sort/filter
      }
    },
    onStoryUpdated: (data) => {
      setStories(prev => prev.map(s => s.id === data.story.id ? data.story : s));
    },
    onStoryStatusChanged: (data) => {
      setStories(prev => prev.map(s => s.id === data.storyId ? { ...s, status: data.newStatus } : s));
    },
  });

  const handleSearch = () => {
    setCurrentPage(1);
    loadStories();
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setEpicFilter('');
    setMinComplexity('');
    setMaxComplexity('');
    setSortBy('createdAt');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  const hasFilters = search || statusFilter || epicFilter || minComplexity !== '' || maxComplexity !== '';

  return (
    <div>
      <div className="mb-6">
        <Breadcrumbs
          items={[
            { name: 'Stories', testId: 'breadcrumb-stories' },
          ]}
        />
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stories</h1>
        <button
          data-testid="create-story"
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          onClick={() => navigate(`/projects/${projectId}/stories/new`)}
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Create Story
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
          {hasFilters && (
            <button
              data-testid="clear-filters"
              onClick={handleClearFilters}
              className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center"
            >
              <XMarkIcon className="h-4 w-4 mr-1" />
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  data-testid="search-stories"
                  className="w-full rounded-md border-gray-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Search stories..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium"
              >
                Search
              </button>
            </div>
          </div>

          {/* Status filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              data-testid="filter-status"
              className="w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StoryStatus | '')}
            >
              <option value="">All statuses</option>
              <option value="planning">Planning</option>
              <option value="analysis">Analysis</option>
              <option value="architecture">Architecture</option>
              <option value="design">Design</option>
              <option value="implementation">Implementation</option>
              <option value="review">Review</option>
              <option value="qa">QA</option>
              <option value="done">Done</option>
            </select>
          </div>

          {/* Epic filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Epic</label>
            <select
              data-testid="filter-epic"
              className="w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              value={epicFilter}
              onChange={(e) => setEpicFilter(e.target.value)}
            >
              <option value="">All epics</option>
              {epics.map(epic => (
                <option key={epic.id} value={epic.id}>{epic.key} - {epic.title}</option>
              ))}
            </select>
          </div>

          {/* Complexity filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Complexity</label>
            <select
              data-testid="filter-tech-complexity"
              className="w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              value={minComplexity}
              onChange={(e) => setMinComplexity(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Any</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              data-testid="sort-by"
              className="w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split(':');
                setSortBy(field);
                setSortOrder(order as 'asc' | 'desc');
              }}
            >
              <option value="createdAt:desc">Newest first</option>
              <option value="createdAt:asc">Oldest first</option>
              <option value="title:asc">Title A-Z</option>
              <option value="title:desc">Title Z-A</option>
              <option value="status:asc">Status A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Story List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        </div>
      ) : stories.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No stories found</p>
        </div>
      ) : (
        <div className="space-y-4" data-testid="story-list">
          {stories.map((story) => (
            <Link
              key={story.id}
              to={`/projects/${projectId}/stories/${story.id}`}
              data-testid={`story-${story.id}`}
              className="block bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-mono text-gray-500">{story.key}</span>
                    <span
                      data-testid="story-status"
                      className={clsx(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        STATUS_COLORS[story.status]
                      )}
                    >
                      {story.status}
                    </span>
                    {story.epic && (
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                        data-testid="story-epic"
                        title={story.epic.title}
                      >
                        {story.epic.key}: {story.epic.title}
                      </span>
                    )}
                  </div>
                  <h3 data-testid="story-title" className="text-lg font-medium text-gray-900 mb-2">
                    {story.title}
                  </h3>
                  {story.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{story.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    {story.technicalComplexity && (
                      <span>Tech: {story.technicalComplexity}/5</span>
                    )}
                    {story.businessImpact && (
                      <span>Impact: {story.businessImpact}/5</span>
                    )}
                    {story._count && (
                      <>
                        <span>{story._count.subtasks} subtasks</span>
                        <span>{story._count.commits} commits</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="mt-6 flex justify-between items-center">
          <div className="text-sm text-gray-700">
            Showing {(currentPage - 1) * limit + 1} to {Math.min(currentPage * limit, total)} of {total} results
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={currentPage * limit >= total}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
