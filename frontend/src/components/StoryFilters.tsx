import { Epic, StoryStatus, StoryType } from '../types';
import { FunnelIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface StoryFiltersProps {
  epics: Epic[];
  selectedEpic: string;
  selectedStatus: StoryStatus | 'all';
  selectedType: StoryType | 'all';
  searchQuery: string;
  onEpicChange: (epicId: string) => void;
  onStatusChange: (status: StoryStatus | 'all') => void;
  onTypeChange: (type: StoryType | 'all') => void;
  onSearchChange: (query: string) => void;
}

export function StoryFilters({
  epics,
  selectedEpic,
  selectedStatus,
  selectedType,
  searchQuery,
  onEpicChange,
  onStatusChange,
  onTypeChange,
  onSearchChange,
}: StoryFiltersProps) {
  const hasFilters = selectedEpic !== 'all' || selectedStatus !== 'all' || selectedType !== 'all' || searchQuery;

  const handleClearFilters = () => {
    onEpicChange('all');
    onStatusChange('all');
    onTypeChange('all');
    onSearchChange('');
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FunnelIcon className="h-6 w-6 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        </div>
        {hasFilters && (
          <button
            onClick={handleClearFilters}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <XMarkIcon className="h-4 w-4 mr-1.5" />
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search Stories
          </label>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search stories..."
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        {/* Epic Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Epic
          </label>
          <select
            value={selectedEpic}
            onChange={(e) => onEpicChange(e.target.value)}
            className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="all">All Epics</option>
            {epics.map((epic) => (
              <option key={epic.id} value={epic.id}>
                {epic.key} - {epic.title}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value as StoryStatus | 'all')}
            className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="all">All Statuses</option>
            <option value="backlog">Backlog</option>
            <option value="planning">Planning</option>
            <option value="analysis">Analysis</option>
            <option value="architecture">Architecture</option>
            <option value="implementation">Implementation</option>
            <option value="review">Review</option>
            <option value="qa">QA</option>
            <option value="done">Done</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>

        {/* Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type
          </label>
          <select
            value={selectedType}
            onChange={(e) => onTypeChange(e.target.value as StoryType | 'all')}
            className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="all">All Types</option>
            <option value="feature">Feature</option>
            <option value="bug">Bug</option>
            <option value="tech_debt">Tech Debt</option>
            <option value="spike">Spike</option>
          </select>
        </div>
      </div>
    </div>
  );
}
