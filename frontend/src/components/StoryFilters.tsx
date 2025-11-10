import { Epic, StoryStatus, StoryType } from '../types';

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
  return (
    <div className="bg-white shadow rounded-lg p-4 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Epic Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Epic
          </label>
          <select
            value={selectedEpic}
            onChange={(e) => onEpicChange(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value as StoryStatus | 'all')}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            value={selectedType}
            onChange={(e) => onTypeChange(e.target.value as StoryType | 'all')}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="all">All Types</option>
            <option value="feature">Feature</option>
            <option value="bug">Bug</option>
            <option value="tech_debt">Tech Debt</option>
            <option value="spike">Spike</option>
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search stories..."
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>
    </div>
  );
}
