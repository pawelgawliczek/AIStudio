import { useState } from 'react';

export interface CoordinatorFiltersState {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedActiveFilter: string;
  setSelectedActiveFilter: (value: string) => void;
  selectedDomainFilter: string;
  setSelectedDomainFilter: (value: string) => void;
  selectedWorkflowFilter: string;
  setSelectedWorkflowFilter: (value: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

export function useCoordinatorFilters(): CoordinatorFiltersState {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActiveFilter, setSelectedActiveFilter] = useState<string>('all');
  const [selectedDomainFilter, setSelectedDomainFilter] = useState<string>('all');
  const [selectedWorkflowFilter, setSelectedWorkflowFilter] = useState<string>('all');

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedActiveFilter('all');
    setSelectedDomainFilter('all');
    setSelectedWorkflowFilter('all');
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedActiveFilter !== 'all' ||
    selectedDomainFilter !== 'all' ||
    selectedWorkflowFilter !== 'all';

  return {
    searchQuery,
    setSearchQuery,
    selectedActiveFilter,
    setSelectedActiveFilter,
    selectedDomainFilter,
    setSelectedDomainFilter,
    selectedWorkflowFilter,
    setSelectedWorkflowFilter,
    clearFilters,
    hasActiveFilters,
  };
}
