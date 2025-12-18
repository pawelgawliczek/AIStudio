import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { workflowRunsService, WorkflowRun, RunStatus } from '../services/workflow-runs.service';

interface UseTeamRunsListParams {
  projectId: string;
}

export function useTeamRunsList({ projectId }: UseTeamRunsListParams) {
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [showOutstandingOnly, setShowOutstandingOnly] = useState(false);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch all workflow runs
  const { data: allRuns = [], isLoading } = useQuery({
    queryKey: ['workflow-runs-all', projectId],
    queryFn: () =>
      workflowRunsService.getAll(projectId, {
        includeRelations: true,
      }),
    enabled: !!projectId,
  });

  // Apply filters and sorting
  const filteredRuns = useMemo(() => {
    let runs = [...allRuns];

    // Filter by status
    if (selectedStatus !== 'all') {
      runs = runs.filter(r => r.status === selectedStatus);
    }

    // Filter by team
    if (selectedTeam !== 'all') {
      runs = runs.filter(r => r.workflowId === selectedTeam);
    }

    // Filter by date
    if (dateFilter) {
      runs = runs.filter(r => {
        const runDate = new Date(r.startedAt).toISOString().split('T')[0];
        return runDate === dateFilter;
      });
    }

    // Filter by outstanding (failed or running)
    if (showOutstandingOnly) {
      runs = runs.filter(r =>
        r.status === RunStatus.FAILED ||
        r.status === RunStatus.RUNNING ||
        r.status === RunStatus.PENDING
      );
    }

    // Filter by search query (story key or title)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      runs = runs.filter(r =>
        r.story?.key?.toLowerCase().includes(query) ||
        r.story?.title?.toLowerCase().includes(query)
      );
    }

    // Sort runs
    runs.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
        case 'duration':
          return (b.durationSeconds || 0) - (a.durationSeconds || 0);
        case 'cost':
          return (b.estimatedCost || 0) - (a.estimatedCost || 0);
        case 'newest':
        default:
          return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
      }
    });

    return runs;
  }, [allRuns, selectedStatus, selectedTeam, dateFilter, showOutstandingOnly, sortBy, searchQuery]);

  // Get unique teams from runs
  const teams = useMemo(() => {
    const uniqueTeams = new Map<string, { id: string; name: string }>();
    allRuns.forEach(run => {
      if (run.workflow?.id && run.workflow?.name) {
        uniqueTeams.set(run.workflow.id, {
          id: run.workflow.id,
          name: run.workflow.name,
        });
      }
    });
    return Array.from(uniqueTeams.values());
  }, [allRuns]);

  const clearFilters = () => {
    setSelectedStatus('all');
    setSelectedTeam('all');
    setDateFilter('');
    setShowOutstandingOnly(false);
    setSortBy('newest');
    setSearchQuery('');
  };

  const hasActiveFilters =
    selectedStatus !== 'all' ||
    selectedTeam !== 'all' ||
    dateFilter !== '' ||
    showOutstandingOnly ||
    sortBy !== 'newest' ||
    searchQuery !== '';

  return {
    runs: filteredRuns,
    allRuns,
    isLoading,
    teams,
    filters: {
      selectedStatus,
      selectedTeam,
      dateFilter,
      showOutstandingOnly,
      sortBy,
      searchQuery,
      setSelectedStatus,
      setSelectedTeam,
      setDateFilter,
      setShowOutstandingOnly,
      setSortBy,
      setSearchQuery,
    },
    hasActiveFilters,
    clearFilters,
  };
}
