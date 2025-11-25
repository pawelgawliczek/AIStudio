import { useState } from 'react';

export interface ComponentFiltersState {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedActiveFilter: string;
  setSelectedActiveFilter: (value: string) => void;
  selectedTagFilter: string;
  setSelectedTagFilter: (value: string) => void;
  selectedWorkflowFilter: string;
  setSelectedWorkflowFilter: (value: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

export function useComponentFilters(): ComponentFiltersState {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActiveFilter, setSelectedActiveFilter] = useState<string>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [selectedWorkflowFilter, setSelectedWorkflowFilter] = useState<string>('all');

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedActiveFilter('all');
    setSelectedTagFilter('all');
    setSelectedWorkflowFilter('all');
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedActiveFilter !== 'all' ||
    selectedTagFilter !== 'all' ||
    selectedWorkflowFilter !== 'all';

  return {
    searchQuery,
    setSearchQuery,
    selectedActiveFilter,
    setSelectedActiveFilter,
    selectedTagFilter,
    setSelectedTagFilter,
    selectedWorkflowFilter,
    setSelectedWorkflowFilter,
    clearFilters,
    hasActiveFilters,
  };
}
