import { useState, useEffect } from 'react';

interface UseCaseSearchBarProps {
  onSearch: (query: string, mode: 'text' | 'semantic' | 'component') => void;
  initialMode?: 'text' | 'semantic' | 'component';
}

export function UseCaseSearchBar({ onSearch, initialMode = 'text' }: UseCaseSearchBarProps) {
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'text' | 'semantic' | 'component'>(initialMode);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  // Trigger search when debounced query or mode changes
  useEffect(() => {
    onSearch(debouncedQuery, searchMode);
  }, [debouncedQuery, searchMode, onSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query, searchMode);
  };

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-sm">
      <form onSubmit={handleSubmit}>
        <div className="flex gap-4">
          {/* Search Input */}
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search use cases..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Search Mode Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Mode:</label>
            <select
              value={searchMode}
              onChange={(e) => setSearchMode(e.target.value as 'text' | 'semantic' | 'component')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="text">Text Search</option>
              <option value="semantic">Semantic Search</option>
              <option value="component">Component Search</option>
            </select>
          </div>

          {/* Search Button */}
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </div>

        {/* Search Mode Description */}
        <div className="mt-2 text-xs text-gray-500">
          {searchMode === 'text' && (
            <p>Search by keywords in title, summary, and content</p>
          )}
          {searchMode === 'semantic' && (
            <p>AI-powered semantic search finds conceptually similar use cases</p>
          )}
          {searchMode === 'component' && (
            <p>Search by component name, layer, or architectural area</p>
          )}
        </div>
      </form>
    </div>
  );
}
