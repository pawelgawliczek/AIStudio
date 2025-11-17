import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useProject } from '../context/ProjectContext';
import { apiClient } from '../services/api.client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface WorkflowMetrics {
  id: string;
  name: string;
  storiesCount: number;
  bugsCount: number;
  avgPromptsPerStory: number;
  avgTokensPerLOC: number;
}

interface DashboardData {
  kpis: {
    storiesImplemented: number;
    storiesChange: number;
    tokensPerLOC: number;
    tokensPerLOCChange: number;
    promptsPerStory: number;
    promptsPerStoryChange: number;
    timePerLOC: number;
    timePerLOCChange: number;
  };
  trends: {
    storiesImplemented: { date: string; allWorkflows: number; selectedWorkflows: number }[];
    tokensPerLOC: { date: string; allWorkflows: number; selectedWorkflows: number }[];
    promptsPerStory: { date: string; allWorkflows: number; selectedWorkflows: number }[];
    timePerLOC: { date: string; allWorkflows: number; selectedWorkflows: number }[];
  };
  workflows: { id: string; name: string }[];
  workflowsWithMetrics: WorkflowMetrics[];
  counts: {
    filteredStories: number;
    totalStories: number;
    filteredBugs: number;
    totalBugs: number;
  };
  generatedAt: string;
}

type DateRangeType = 'week' | 'month' | 'quarter' | 'custom';
type ComplexityLevel = 'all' | 'low' | 'medium' | 'high';

// SVG Icon Components
const ChevronDownIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TrendingUpIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.333 13.333L7.917 8.75L11.25 12.083L16.667 6.667M16.667 6.667H12.5M16.667 6.667V10.833" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TrendingDownIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.333 6.667L7.917 11.25L11.25 7.917L16.667 13.333M16.667 13.333H12.5M16.667 13.333V9.167" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ArrowRightIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.333 8H12.667M12.667 8L8.667 4M12.667 8L8.667 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const InfoIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 7V11M8 5.5V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const CalendarIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M3 8H17M7 2V5M13 2V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export function PerformanceDashboard() {
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id || '';

  // Filters
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRangeType>('month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [businessComplexity, setBusinessComplexity] = useState<ComplexityLevel>('all');
  const [technicalComplexity, setTechnicalComplexity] = useState<ComplexityLevel>('all');

  // Dropdown states
  const [showWorkflowSelector, setShowWorkflowSelector] = useState(false);
  const [showDateRangeSelector, setShowDateRangeSelector] = useState(false);
  const [showBusinessComplexitySelector, setShowBusinessComplexitySelector] = useState(false);
  const [showTechnicalComplexitySelector, setShowTechnicalComplexitySelector] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [workflowTablePage, setWorkflowTablePage] = useState(0);
  const workflowsPerPage = 5;

  // Refs for click outside detection
  const workflowRef = useRef<HTMLDivElement>(null);
  const dateRangeRef = useRef<HTMLDivElement>(null);
  const businessComplexityRef = useRef<HTMLDivElement>(null);
  const technicalComplexityRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (workflowRef.current && !workflowRef.current.contains(event.target as Node)) {
        setShowWorkflowSelector(false);
      }
      if (dateRangeRef.current && !dateRangeRef.current.contains(event.target as Node)) {
        setShowDateRangeSelector(false);
      }
      if (businessComplexityRef.current && !businessComplexityRef.current.contains(event.target as Node)) {
        setShowBusinessComplexitySelector(false);
      }
      if (technicalComplexityRef.current && !technicalComplexityRef.current.contains(event.target as Node)) {
        setShowTechnicalComplexitySelector(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Convert complexity level to min/max range
  const getComplexityRange = (level: ComplexityLevel): [number, number] => {
    switch (level) {
      case 'low': return [1, 3];
      case 'medium': return [4, 6];
      case 'high': return [7, 10];
      case 'all':
      default: return [1, 10];
    }
  };

  const businessComplexityRange = getComplexityRange(businessComplexity);
  const technicalComplexityRange = getComplexityRange(technicalComplexity);

  // Fetch performance dashboard data
  const { data: dashboardData, isLoading, isFetching, error } = useQuery<DashboardData>({
    queryKey: [
      'performance-dashboard',
      projectId,
      selectedWorkflowIds,
      dateRange,
      customStartDate,
      customEndDate,
      businessComplexityRange,
      technicalComplexityRange,
    ],
    queryFn: async () => {
      if (!projectId) throw new Error('No project selected');
      const params: any = {
        projectId,
        dateRange,
        businessComplexityMin: businessComplexityRange[0],
        businessComplexityMax: businessComplexityRange[1],
        technicalComplexityMin: technicalComplexityRange[0],
        technicalComplexityMax: technicalComplexityRange[1],
      };
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        params.startDate = customStartDate;
        params.endDate = customEndDate;
      }
      if (selectedWorkflowIds.length > 0) {
        params.workflowIds = selectedWorkflowIds.join(',');
      }
      const response = await apiClient.get('/agent-metrics/performance-dashboard', { params });
      return response.data;
    },
    enabled: !!projectId && (dateRange !== 'custom' || (!!customStartDate && !!customEndDate)),
    refetchInterval: 60000,
    placeholderData: keepPreviousData, // Prevents blinking by keeping old data while loading new
  });

  const handleWorkflowToggle = useCallback((workflowId: string) => {
    setSelectedWorkflowIds((prev) =>
      prev.includes(workflowId)
        ? prev.filter((id) => id !== workflowId)
        : [...prev, workflowId]
    );
  }, []);

  const getDateRangeLabel = () => {
    switch (dateRange) {
      case 'week': return 'Last 7 Days';
      case 'month': return 'Last 30 Days';
      case 'quarter': return 'Last 90 Days';
      case 'custom': return customStartDate && customEndDate
        ? `${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()}`
        : 'Custom Range';
      default: return 'Last 30 Days';
    }
  };

  const getComplexityLabel = (level: ComplexityLevel) => {
    switch (level) {
      case 'low': return 'Low (1-3)';
      case 'medium': return 'Medium (4-6)';
      case 'high': return 'High (7-10)';
      case 'all':
      default: return 'All Levels';
    }
  };

  // Format date for X axis
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // KPI Card Component
  const KPICard = ({
    title,
    value,
    change,
    unit = '',
    infoText = '',
    invertColor = false,
  }: {
    title: string;
    value: number;
    change: number;
    unit?: string;
    infoText?: string;
    invertColor?: boolean;
  }) => {
    const isPositive = invertColor ? change < 0 : change > 0;
    const trendColor = isPositive ? 'text-green-500' : 'text-red-500';

    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          {infoText && (
            <div className="text-gray-400 dark:text-gray-500 cursor-help" title={infoText}>
              <InfoIcon />
            </div>
          )}
        </div>
        <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
          {value.toLocaleString()}
          {unit}
        </p>
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span className={trendColor}>
            {isPositive ? <TrendingUpIcon /> : <TrendingDownIcon />}
          </span>
          <span>
            {change > 0 ? '+' : ''}
            {change.toFixed(1)}% vs last period
          </span>
        </div>
      </div>
    );
  };

  // Chart Component with dual lines
  const TrendChart = ({
    title,
    subtitle,
    data,
    valueKey = 'selectedWorkflows',
    allKey = 'allWorkflows',
    showAllWorkflows = selectedWorkflowIds.length > 0,
  }: {
    title: string;
    subtitle: string;
    data: { date: string; allWorkflows: number; selectedWorkflows: number }[];
    valueKey?: string;
    allKey?: string;
    showAllWorkflows?: boolean;
  }) => (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      <p className="font-semibold text-gray-900 dark:text-white">{title}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
      <div className="mt-4 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#9CA3AF"
              fontSize={12}
            />
            <YAxis stroke="#9CA3AF" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: 'none',
                borderRadius: '8px',
                color: '#F9FAFB',
              }}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
            />
            <Legend />
            {showAllWorkflows && (
              <Line
                type="monotone"
                dataKey={allKey}
                stroke="#6B7280"
                strokeDasharray="5 5"
                strokeWidth={2}
                dot={false}
                name="All Workflows"
              />
            )}
            <Line
              type="monotone"
              dataKey={valueKey}
              stroke="#135bec"
              strokeWidth={3}
              dot={{ fill: '#135bec', strokeWidth: 2 }}
              activeDot={{ r: 8 }}
              name={showAllWorkflows ? 'Selected Workflows' : 'All Workflows'}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 dark:text-gray-400">
          Please select a project to view performance metrics.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 px-4 py-8 md:px-6 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-500 dark:text-gray-400">
                Loading performance metrics...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 px-4 py-8 md:px-6 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
              Error Loading Metrics
            </h2>
            <p className="text-red-600 dark:text-red-300">
              {error instanceof Error ? error.message : 'Failed to load performance metrics'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const kpis = dashboardData?.kpis || {
    storiesImplemented: 0,
    storiesChange: 0,
    tokensPerLOC: 0,
    tokensPerLOCChange: 0,
    promptsPerStory: 0,
    promptsPerStoryChange: 0,
    timePerLOC: 0,
    timePerLOCChange: 0,
  };

  const trends = dashboardData?.trends || {
    storiesImplemented: [],
    tokensPerLOC: [],
    promptsPerStory: [],
    timePerLOC: [],
  };

  const availableWorkflows = dashboardData?.workflows || [];
  const workflowsWithMetrics = dashboardData?.workflowsWithMetrics || [];
  const counts = dashboardData?.counts || { filteredStories: 0, totalStories: 0, filteredBugs: 0, totalBugs: 0 };

  // Pagination for workflows table
  const totalWorkflowPages = Math.ceil(workflowsWithMetrics.length / workflowsPerPage);
  const paginatedWorkflows = workflowsWithMetrics.slice(
    workflowTablePage * workflowsPerPage,
    (workflowTablePage + 1) * workflowsPerPage
  );

  return (
    <div className="flex-1 px-4 py-8 md:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Page Heading */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-900 dark:text-white text-3xl md:text-4xl font-black leading-tight tracking-tight">
                Dashboard
              </p>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Compare agentic workflow performance and efficiency.
              </p>
            </div>
            {/* Loading indicator and counts */}
            <div className="flex items-center gap-4">
              {isFetching && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Updating...</span>
                </div>
              )}
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Stories:</span>{' '}
                <span className="text-gray-900 dark:text-white">
                  {counts.filteredStories === counts.totalStories
                    ? counts.totalStories
                    : `${counts.filteredStories}/${counts.totalStories}`}
                </span>
                <span className="mx-2">|</span>
                <span className="font-medium">Bugs:</span>{' '}
                <span className="text-gray-900 dark:text-white">
                  {counts.filteredBugs === counts.totalBugs
                    ? counts.totalBugs
                    : `${counts.filteredBugs}/${counts.totalBugs}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Workflows Table */}
        {workflowsWithMetrics.length > 0 && (
          <div className="mb-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Workflows Overview
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Workflow Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Stories
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Bugs
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Avg. Prompts/Story
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Avg. Tokens/LOC
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedWorkflows.map((workflow) => (
                    <tr key={workflow.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {workflow.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {workflow.storiesCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {workflow.bugsCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {workflow.avgPromptsPerStory.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {workflow.avgTokensPerLOC.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={() => window.location.href = `/analytics/workflow-details?id=${workflow.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
                        >
                          Details
                          <ArrowRightIcon />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalWorkflowPages > 1 && (
              <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {workflowTablePage * workflowsPerPage + 1} to{' '}
                  {Math.min((workflowTablePage + 1) * workflowsPerPage, workflowsWithMetrics.length)} of{' '}
                  {workflowsWithMetrics.length} workflows
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setWorkflowTablePage(prev => Math.max(0, prev - 1))}
                    disabled={workflowTablePage === 0}
                    className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Page {workflowTablePage + 1} of {totalWorkflowPages}
                  </span>
                  <button
                    onClick={() => setWorkflowTablePage(prev => Math.min(totalWorkflowPages - 1, prev + 1))}
                    disabled={workflowTablePage >= totalWorkflowPages - 1}
                    className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filter Bar */}
        <div className="mb-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {/* Select Workflows */}
            <div className="flex flex-col gap-2" ref={workflowRef}>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Workflows
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowWorkflowSelector(!showWorkflowSelector)}
                  className="flex h-10 w-full items-center justify-between gap-x-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <p className="text-sm font-medium text-gray-800 dark:text-white">
                    {selectedWorkflowIds.length === 0
                      ? 'All Workflows'
                      : `${selectedWorkflowIds.length} Selected`}
                  </p>
                  <ChevronDownIcon className="text-gray-500 dark:text-gray-400" />
                </button>
                {showWorkflowSelector && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10 max-h-60 overflow-auto">
                    <div
                      className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                      onClick={() => {
                        setSelectedWorkflowIds([]);
                        setShowWorkflowSelector(false);
                      }}
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        All Workflows
                      </span>
                    </div>
                    {availableWorkflows.map((wf) => (
                      <div
                        key={wf.id}
                        className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer flex items-center gap-2"
                        onClick={() => handleWorkflowToggle(wf.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedWorkflowIds.includes(wf.id)}
                          readOnly
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {wf.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Date Range Picker */}
            <div className="flex flex-col gap-2" ref={dateRangeRef}>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Date Range
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowDateRangeSelector(!showDateRangeSelector)}
                  className="flex h-10 w-full items-center justify-between gap-x-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                    {getDateRangeLabel()}
                  </p>
                  <CalendarIcon className="text-gray-500 dark:text-gray-400" />
                </button>
                {showDateRangeSelector && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10">
                    {(['week', 'month', 'quarter'] as DateRangeType[]).map((option) => (
                      <div
                        key={option}
                        className={`px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer ${
                          dateRange === option ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                        }`}
                        onClick={() => {
                          setDateRange(option);
                          setShowDateRangeSelector(false);
                          setShowCustomDatePicker(false);
                        }}
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {option === 'week' ? 'Last 7 Days' : option === 'month' ? 'Last 30 Days' : 'Last 90 Days'}
                        </span>
                      </div>
                    ))}
                    <div
                      className={`px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer ${
                        dateRange === 'custom' ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                      }`}
                      onClick={() => {
                        setShowCustomDatePicker(true);
                        setDateRange('custom');
                      }}
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300">Custom Range</span>
                    </div>
                    {showCustomDatePicker && (
                      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="space-y-2">
                          <div>
                            <label className="text-xs text-gray-500">Start Date</label>
                            <input
                              type="date"
                              value={customStartDate}
                              onChange={(e) => setCustomStartDate(e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">End Date</label>
                            <input
                              type="date"
                              value={customEndDate}
                              onChange={(e) => setCustomEndDate(e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                          </div>
                          <button
                            onClick={() => setShowDateRangeSelector(false)}
                            className="w-full px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Business Complexity Dropdown */}
            <div className="flex flex-col gap-2" ref={businessComplexityRef}>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Business Complexity
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowBusinessComplexitySelector(!showBusinessComplexitySelector)}
                  className="flex h-10 w-full items-center justify-between gap-x-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <p className="text-sm font-medium text-gray-800 dark:text-white">
                    {getComplexityLabel(businessComplexity)}
                  </p>
                  <ChevronDownIcon className="text-gray-500 dark:text-gray-400" />
                </button>
                {showBusinessComplexitySelector && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10">
                    {(['all', 'low', 'medium', 'high'] as ComplexityLevel[]).map((level) => (
                      <div
                        key={level}
                        className={`px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer ${
                          businessComplexity === level ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                        }`}
                        onClick={() => {
                          setBusinessComplexity(level);
                          setShowBusinessComplexitySelector(false);
                        }}
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {getComplexityLabel(level)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Technical Complexity Dropdown */}
            <div className="flex flex-col gap-2" ref={technicalComplexityRef}>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Architecture Complexity
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowTechnicalComplexitySelector(!showTechnicalComplexitySelector)}
                  className="flex h-10 w-full items-center justify-between gap-x-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <p className="text-sm font-medium text-gray-800 dark:text-white">
                    {getComplexityLabel(technicalComplexity)}
                  </p>
                  <ChevronDownIcon className="text-gray-500 dark:text-gray-400" />
                </button>
                {showTechnicalComplexitySelector && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10">
                    {(['all', 'low', 'medium', 'high'] as ComplexityLevel[]).map((level) => (
                      <div
                        key={level}
                        className={`px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer ${
                          technicalComplexity === level ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                        }`}
                        onClick={() => {
                          setTechnicalComplexity(level);
                          setShowTechnicalComplexitySelector(false);
                        }}
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {getComplexityLabel(level)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* KPI Section */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Performance Overview
          </h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Stories Implemented"
              value={kpis.storiesImplemented}
              change={kpis.storiesChange}
              infoText="Total number of stories completed during the selected period"
            />
            <KPICard
              title="Tokens / LOC"
              value={kpis.tokensPerLOC}
              change={kpis.tokensPerLOCChange}
              infoText="Average number of tokens consumed per line of code generated"
              invertColor={true}
            />
            <KPICard
              title="Prompts / Story"
              value={kpis.promptsPerStory}
              change={kpis.promptsPerStoryChange}
              infoText="Average number of prompts/interactions per story"
            />
            <KPICard
              title="Time / LOC"
              value={kpis.timePerLOC}
              change={kpis.timePerLOCChange}
              unit="m"
              infoText="Average time in minutes per line of code generated"
              invertColor={true}
            />
          </div>
        </div>

        {/* Trends Section */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Performance Trends
          </h3>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TrendChart
              title="Stories Implemented Over Time"
              subtitle="Total stories completed daily"
              data={trends.storiesImplemented}
            />
            <TrendChart
              title="Tokens / LOC Over Time"
              subtitle="Daily average token usage per line of code"
              data={trends.tokensPerLOC}
            />
            <TrendChart
              title="Prompts / Story Over Time"
              subtitle="Daily average number of prompts per story"
              data={trends.promptsPerStory}
            />
            <TrendChart
              title="Time / LOC Over Time"
              subtitle="Daily average time spent per line of code (minutes)"
              data={trends.timePerLOC}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
