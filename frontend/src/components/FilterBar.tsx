import React from 'react';

export interface FilterOption {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  visible?: boolean;
}

export interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters: FilterOption[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters,
  hasActiveFilters,
  onClearFilters,
}: FilterBarProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-4">
        {/* Search Input */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-accent"
          />
        </div>

        {/* Dynamic Filters */}
        {filters.map((filter, index) => {
          // Only render if visible is undefined or true
          if (filter.visible === false) return null;

          return (
            <div key={index} className="flex items-center gap-2">
              <label className="text-sm font-medium text-fg">{filter.label}:</label>
              <select
                value={filter.value}
                onChange={(e) => filter.onChange(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-accent"
              >
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-sm text-muted hover:text-fg underline"
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  );
}
