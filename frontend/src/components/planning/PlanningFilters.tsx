import { useState } from 'react';
import { StoryStatus, StoryType, SubtaskLayer, Epic } from '../../types';

interface PlanningFiltersProps {
  statusFilter: string[];
  typeFilter: string[];
  epicFilter: string[];
  layerFilter: string[];
  searchQuery: string;
  epics: Epic[];
  onStatusChange: (value: string[]) => void;
  onTypeChange: (value: string[]) => void;
  onEpicChange: (value: string[]) => void;
  onLayerChange: (value: string[]) => void;
  onSearchChange: (value: string) => void;
}

export function PlanningFilters({
  statusFilter,
  typeFilter,
  epicFilter,
  layerFilter,
  searchQuery,
  epics,
  onStatusChange,
  onTypeChange,
  onEpicChange,
  onLayerChange,
  onSearchChange,
}: PlanningFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(searchQuery);

  const toggleStatus = (status: string) => {
    if (statusFilter.includes(status)) {
      onStatusChange(statusFilter.filter(s => s !== status));
    } else {
      onStatusChange([...statusFilter, status]);
    }
  };

  const toggleType = (type: string) => {
    if (typeFilter.includes(type)) {
      onTypeChange(typeFilter.filter(t => t !== type));
    } else {
      onTypeChange([...typeFilter, type]);
    }
  };

  const toggleEpic = (epicId: string) => {
    if (epicFilter.includes(epicId)) {
      onEpicChange(epicFilter.filter(e => e !== epicId));
    } else {
      onEpicChange([...epicFilter, epicId]);
    }
  };

  const toggleLayer = (layer: string) => {
    if (layerFilter.includes(layer)) {
      onLayerChange(layerFilter.filter(l => l !== layer));
    } else {
      onLayerChange([...layerFilter, layer]);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(searchValue);
  };

  const statusOptions = Object.values(StoryStatus);
  const typeOptions = Object.values(StoryType);
  const layerOptions = Object.values(SubtaskLayer);

  return (
    <div className="relative">
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <span className="text-sm font-medium">Filters</span>
        {(statusFilter.length + typeFilter.length + epicFilter.length + layerFilter.length) > 0 && (
          <span className="flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-primary rounded-full">
            {statusFilter.length + typeFilter.length + epicFilter.length + layerFilter.length}
          </span>
        )}
      </button>

      {/* Filter Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Content */}
          <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-lg shadow-lg z-20 max-h-[600px] overflow-y-auto">
            <div className="p-4 space-y-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-fg mb-2">Search</label>
                <form onSubmit={handleSearchSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder="Search stories..."
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
                  >
                    Go
                  </button>
                </form>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-fg mb-2">Status</label>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {statusOptions.map((status) => (
                    <label key={status} className="flex items-center gap-2 cursor-pointer hover:bg-muted px-2 py-1 rounded">
                      <input
                        type="checkbox"
                        checked={statusFilter.includes(status)}
                        onChange={() => toggleStatus(status)}
                        className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                      />
                      <span className="text-sm capitalize">{status.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-fg mb-2">Type</label>
                <div className="space-y-1">
                  {typeOptions.map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer hover:bg-muted px-2 py-1 rounded">
                      <input
                        type="checkbox"
                        checked={typeFilter.includes(type)}
                        onChange={() => toggleType(type)}
                        className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                      />
                      <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Epic Filter */}
              <div>
                <label className="block text-sm font-medium text-fg mb-2">Epic</label>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {epics.map((epic) => (
                    <label key={epic.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted px-2 py-1 rounded">
                      <input
                        type="checkbox"
                        checked={epicFilter.includes(epic.id)}
                        onChange={() => toggleEpic(epic.id)}
                        className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                      />
                      <span className="text-sm">{epic.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Layer/Component Filter */}
              <div>
                <label className="block text-sm font-medium text-fg mb-2">Layer/Component</label>
                <div className="space-y-1">
                  {layerOptions.map((layer) => (
                    <label key={layer} className="flex items-center gap-2 cursor-pointer hover:bg-muted px-2 py-1 rounded">
                      <input
                        type="checkbox"
                        checked={layerFilter.includes(layer)}
                        onChange={() => toggleLayer(layer)}
                        className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                      />
                      <span className="text-sm capitalize">{layer}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
