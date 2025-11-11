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
    <div className="bg-card border border-border rounded-lg shadow-md p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Epic Filter */}
        <div>
          <label className="block text-sm font-medium text-fg mb-2">
            Epic
          </label>
          <select
            value={selectedEpic}
            onChange={(e) => onEpicChange(e.target.value)}
            className="block w-full px-4 py-2 bg-bg-secondary border border-border rounded-lg text-fg focus:border-accent focus:ring-2 focus:ring-ring transition-colors"
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
          <label className="block text-sm font-medium text-fg mb-2">
            Status
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value as StoryStatus | 'all')}
            className="block w-full px-4 py-2 bg-bg-secondary border border-border rounded-lg text-fg focus:border-accent focus:ring-2 focus:ring-ring transition-colors"
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
          <label className="block text-sm font-medium text-fg mb-2">
            Type
          </label>
          <select
            value={selectedType}
            onChange={(e) => onTypeChange(e.target.value as StoryType | 'all')}
            className="block w-full px-4 py-2 bg-bg-secondary border border-border rounded-lg text-fg focus:border-accent focus:ring-2 focus:ring-ring transition-colors"
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
          <label className="block text-sm font-medium text-fg mb-2">
            Search
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search stories..."
            className="block w-full px-4 py-2 bg-bg-secondary border border-border rounded-lg text-fg placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-ring transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
