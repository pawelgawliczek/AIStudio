import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProject } from '../context/ProjectContext';
import { metricsService, TimeGranularity } from '../services/metrics.service';
import { WorkflowsTab } from '../components/performance/WorkflowsTab';
import { ComponentsTab } from '../components/performance/ComponentsTab';
import { TrendsTab } from '../components/performance/TrendsTab';
import { ComparisonsTab } from '../components/performance/ComparisonsTab';

type TabType = 'workflows' | 'components' | 'trends' | 'comparisons';

export function PerformanceDashboard() {
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id || '';

  const [activeTab, setActiveTab] = useState<TabType>('workflows');
  const [weeks, setWeeks] = useState<number>(8);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [businessComplexity, setBusinessComplexity] = useState<string>('');
  const [technicalComplexity, setTechnicalComplexity] = useState<string>('');

  // Calculate date range for the last N weeks (properly memoized to prevent infinite loops)
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - weeks * 7);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [weeks]);

  // Fetch weekly aggregations
  const { data: weeklyData, isLoading, error } = useQuery({
    queryKey: ['weekly-metrics', projectId, weeks, businessComplexity, technicalComplexity],
    queryFn: async () => {
      if (!projectId) throw new Error('No project selected');
      return metricsService.getWeeklyAggregations(
        projectId,
        weeks,
        businessComplexity ? parseInt(businessComplexity) : undefined,
        technicalComplexity ? parseInt(technicalComplexity) : undefined,
      );
    },
    enabled: !!projectId,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  // Fetch workflow metrics
  const { data: workflowMetrics, isLoading: isLoadingWorkflows, error: workflowError } = useQuery({
    queryKey: ['workflow-metrics', projectId, selectedWorkflowId, weeks, businessComplexity, technicalComplexity],
    queryFn: async () => {
      if (!projectId) throw new Error('No project selected');
      return metricsService.getWorkflowMetrics(projectId, {
        workflowId: selectedWorkflowId || undefined,
        startDate,
        endDate,
        granularity: TimeGranularity.WEEKLY,
        businessComplexity: businessComplexity ? parseInt(businessComplexity) : undefined,
        technicalComplexity: technicalComplexity ? parseInt(technicalComplexity) : undefined,
      });
    },
    enabled: !!projectId,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  // Fetch component metrics
  const { data: componentMetrics, isLoading: isLoadingComponents, error: componentError } = useQuery({
    queryKey: ['component-metrics', projectId, weeks, businessComplexity, technicalComplexity],
    queryFn: async () => {
      if (!projectId) throw new Error('No project selected');
      return metricsService.getComponentMetrics(projectId, {
        startDate,
        endDate,
        granularity: TimeGranularity.WEEKLY,
        businessComplexity: businessComplexity ? parseInt(businessComplexity) : undefined,
        technicalComplexity: technicalComplexity ? parseInt(technicalComplexity) : undefined,
      });
    },
    enabled: !!projectId,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  // Fetch trends
  const { data: trendsData, isLoading: isLoadingTrends, error: trendsError } = useQuery({
    queryKey: ['trends', projectId, selectedWorkflowId, weeks, businessComplexity, technicalComplexity],
    queryFn: async () => {
      if (!projectId) throw new Error('No project selected');
      return metricsService.getTrends(projectId, {
        workflowId: selectedWorkflowId || undefined,
        startDate,
        endDate,
        granularity: TimeGranularity.WEEKLY,
        businessComplexity: businessComplexity ? parseInt(businessComplexity) : undefined,
        technicalComplexity: technicalComplexity ? parseInt(technicalComplexity) : undefined,
      });
    },
    enabled: !!projectId,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Please select a project to view performance metrics.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading performance metrics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Metrics</h2>
          <p className="text-red-600">
            {error instanceof Error ? error.message : 'Failed to load performance metrics'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Performance Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Analyze workflow and component performance metrics
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Period
            </label>
            <select
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={4}>Last 4 weeks</option>
              <option value={8}>Last 8 weeks</option>
              <option value={12}>Last 12 weeks</option>
              <option value={16}>Last 16 weeks</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workflow
            </label>
            <select
              value={selectedWorkflowId}
              onChange={(e) => setSelectedWorkflowId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 min-w-[200px]"
            >
              <option value="">All Workflows</option>
              {weeklyData &&
                Array.from(
                  new Set(
                    weeklyData.flatMap((week) =>
                      week.workflows.map((wf) => JSON.stringify({ id: wf.workflowId, name: wf.workflowName })),
                    ),
                  ),
                )
                  .map((wf) => JSON.parse(wf))
                  .map((wf) => (
                    <option key={wf.id} value={wf.id}>
                      {wf.name}
                    </option>
                  ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Complexity
            </label>
            <select
              value={businessComplexity}
              onChange={(e) => setBusinessComplexity(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 min-w-[160px]"
            >
              <option value="">All Levels</option>
              <option value="1">1 - Very Low</option>
              <option value="2">2 - Low</option>
              <option value="3">3 - Medium</option>
              <option value="4">4 - High</option>
              <option value="5">5 - Very High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Technical Complexity
            </label>
            <select
              value={technicalComplexity}
              onChange={(e) => setTechnicalComplexity(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 min-w-[160px]"
            >
              <option value="">All Levels</option>
              <option value="1">1 - Very Low</option>
              <option value="2">2 - Low</option>
              <option value="3">3 - Medium</option>
              <option value="4">4 - High</option>
              <option value="5">5 - Very High</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-6">
          <button
            onClick={() => setActiveTab('workflows')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'workflows'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Workflows
          </button>
          <button
            onClick={() => setActiveTab('components')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'components'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Components
          </button>
          <button
            onClick={() => setActiveTab('trends')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'trends'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Trends
          </button>
          <button
            onClick={() => setActiveTab('comparisons')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'comparisons'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Comparisons
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'workflows' && (
          <WorkflowsTab
            weeklyData={weeklyData || []}
            workflowMetrics={workflowMetrics || []}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'components' && (
          <ComponentsTab
            componentMetrics={componentMetrics || []}
            isLoading={isLoadingComponents}
          />
        )}

        {activeTab === 'trends' && (
          <TrendsTab
            trendsData={trendsData || []}
            weeklyData={weeklyData || []}
            isLoading={isLoading || isLoadingTrends}
          />
        )}

        {activeTab === 'comparisons' && (
          <ComparisonsTab
            projectId={projectId}
            startDate={startDate}
            endDate={endDate}
          />
        )}
      </div>
    </div>
  );
}
