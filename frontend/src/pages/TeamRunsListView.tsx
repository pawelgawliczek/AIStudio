import { useProject } from '../context/ProjectContext';
import { useTeamRunsList } from '../hooks/useTeamRunsList';
import {
  TeamRunsSummaryCards,
  TeamRunsFilters,
  StoryRunsTable,
} from '../components/team-runs';

export function TeamRunsListView() {
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id || '';

  const {
    runs,
    allRuns,
    isLoading,
    teams,
    filters,
    hasActiveFilters,
    clearFilters,
  } = useTeamRunsList({ projectId });

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted">Please select a project to view team runs.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-fg">Team Runs</h1>
        <p className="mt-1 text-sm text-muted">
          View and manage all team workflow executions across your project
        </p>
      </div>

      {/* Summary Cards */}
      <TeamRunsSummaryCards runs={allRuns} />

      {/* Filters */}
      <TeamRunsFilters
        selectedStatus={filters.selectedStatus}
        selectedTeam={filters.selectedTeam}
        dateFilter={filters.dateFilter}
        showOutstandingOnly={filters.showOutstandingOnly}
        sortBy={filters.sortBy}
        searchQuery={filters.searchQuery}
        teams={teams}
        onStatusChange={filters.setSelectedStatus}
        onTeamChange={filters.setSelectedTeam}
        onDateChange={filters.setDateFilter}
        onOutstandingToggle={filters.setShowOutstandingOnly}
        onSortChange={filters.setSortBy}
        onSearchChange={filters.setSearchQuery}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Results Count */}
      <div className="mb-4 text-sm text-muted">
        {isLoading ? (
          <span>Loading runs...</span>
        ) : (
          <span>
            Found {runs.length} run{runs.length !== 1 ? 's' : ''}
            {hasActiveFilters && ' matching filters'}
          </span>
        )}
      </div>

      {/* Table */}
      <StoryRunsTable runs={runs} isLoading={isLoading} />
    </div>
  );
}
