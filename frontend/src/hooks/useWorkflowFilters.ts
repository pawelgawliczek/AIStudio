import { useState } from 'react';

export interface WorkflowFiltersState {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedActiveFilter: string;
  setSelectedActiveFilter: (value: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

export function useWorkflowFilters(): WorkflowFiltersState {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActiveFilter, setSelectedActiveFilter] = useState<string>('all');

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedActiveFilter('all');
  };

  const hasActiveFilters = searchQuery !== '' || selectedActiveFilter !== 'all';

  return {
    searchQuery,
    setSearchQuery,
    selectedActiveFilter,
    setSelectedActiveFilter,
    clearFilters,
    hasActiveFilters,
  };
}
