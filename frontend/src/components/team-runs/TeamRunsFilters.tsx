import { RunStatus } from '../../services/workflow-runs.service';

interface TeamRunsFiltersProps {
  selectedStatus: string;
  selectedTeam: string;
  dateFilter: string;
  showOutstandingOnly: boolean;
  sortBy: string;
  searchQuery: string;
  teams: Array<{ id: string; name: string }>;
  onStatusChange: (status: string) => void;
  onTeamChange: (teamId: string) => void;
  onDateChange: (date: string) => void;
  onOutstandingToggle: (value: boolean) => void;
  onSortChange: (sort: string) => void;
  onSearchChange: (query: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export function TeamRunsFilters({
  selectedStatus,
  selectedTeam,
  dateFilter,
  showOutstandingOnly,
  sortBy,
  searchQuery,
  teams,
  onStatusChange,
  onTeamChange,
  onDateChange,
  onOutstandingToggle,
  onSortChange,
  onSearchChange,
  onClearFilters,
  hasActiveFilters,
}: TeamRunsFiltersProps) {
  return (
    <div className="bg-card rounded-lg shadow border border-border p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Status Filter */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-muted">Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-accent bg-card text-fg"
          >
            <option value="all">All Statuses</option>
            <option value={RunStatus.COMPLETED}>Completed</option>
            <option value={RunStatus.RUNNING}>In Progress</option>
            <option value={RunStatus.FAILED}>Failed</option>
            <option value={RunStatus.PENDING}>Pending</option>
            <option value={RunStatus.CANCELLED}>Cancelled</option>
          </select>
        </div>

        {/* Team Filter */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-muted">Team</label>
          <select
            value={selectedTeam}
            onChange={(e) => onTeamChange(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-accent bg-card text-fg"
          >
            <option value="all">All Teams</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-muted">Date</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => onDateChange(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-accent bg-card text-fg"
          />
        </div>

        {/* Sort By */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-muted">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-accent bg-card text-fg"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="duration">Duration</option>
            <option value="cost">Cost</option>
          </select>
        </div>

        {/* Search */}
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="text-sm font-medium text-muted">Search Stories</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by story key or title..."
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-accent bg-card text-fg"
          />
        </div>

        {/* Outstanding Only Toggle */}
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showOutstandingOnly}
              onChange={(e) => onOutstandingToggle(e.target.checked)}
              className="w-4 h-4 text-accent border-border rounded focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm font-medium text-fg">Outstanding Only</span>
          </label>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <div className="flex items-end">
            <button
              onClick={onClearFilters}
              className="px-4 py-2 text-sm text-muted hover:text-fg underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
