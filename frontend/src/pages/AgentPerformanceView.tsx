import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import axios from 'axios';

// Types
interface EfficiencyMetrics {
  avgTokensPerStory: number;
  avgTokenPerLoc: number;
  storyCycleTimeHours: number;
  promptIterationsPerStory: number;
  parallelizationEfficiencyPercent: number;
  tokenEfficiencyRatio: number;
}

interface QualityMetrics {
  defectsPerStory: number;
  defectLeakagePercent: number;
  codeChurnPercent: number;
  testCoveragePercent: number;
  codeComplexityDeltaPercent: number;
  criticalDefects: number;
}

interface CostMetrics {
  costPerStory: number;
  costPerAcceptedLoc: number;
  storiesCompleted: number;
  acceptedLoc: number;
  reworkCost: number;
  netCost: number;
}

interface FrameworkComparison {
  framework: {
    id: string;
    name: string;
  };
  efficiencyMetrics: EfficiencyMetrics;
  qualityMetrics: QualityMetrics;
  costMetrics: CostMetrics;
  sampleSize: number;
  confidenceLevel: string;
}

interface FrameworkComparisonData {
  projectId: string;
  projectName: string;
  complexityBand: string;
  comparisons: FrameworkComparison[];
  aiInsights: string[];
}

const AgentPerformanceView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'comparison' | 'story' | 'agent' | 'weekly'>(
    'comparison',
  );
  const [loading, setLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState<FrameworkComparisonData | null>(
    null,
  );
  const [complexityBand, setComplexityBand] = useState('all');
  const [dateRange, setDateRange] = useState('last_30_days');
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([]);
  const [availableFrameworks, setAvailableFrameworks] = useState<
    { id: string; name: string }[]
  >([]);

  // Fetch available frameworks
  useEffect(() => {
    const fetchFrameworks = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/projects/${projectId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        // For demo, use mock frameworks
        setAvailableFrameworks([
          { id: 'dev-only', name: 'Dev-only' },
          { id: 'full', name: 'BA+Arch+Dev+QA' },
          { id: 'custom', name: 'Custom Framework' },
        ]);

        // Auto-select first two
        setSelectedFrameworks(['dev-only', 'full']);
      } catch (error) {
        console.error('Failed to fetch frameworks:', error);
      }
    };

    if (projectId) {
      fetchFrameworks();
    }
  }, [projectId]);

  // Fetch framework comparison data
  useEffect(() => {
    const fetchComparisonData = async () => {
      if (selectedFrameworks.length === 0) return;

      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/agent-metrics/framework-comparison`,
          {
            params: {
              projectId,
              frameworkIds: selectedFrameworks.join(','),
              complexityBand,
              dateRange,
            },
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        setComparisonData(response.data);
      } catch (error) {
        console.error('Failed to fetch comparison data:', error);
        // For demo, use mock data
        setComparisonData({
          projectId: projectId || '',
          projectName: 'AI Studio MCP Control Plane',
          complexityBand,
          comparisons: [
            {
              framework: { id: 'dev-only', name: 'Dev-only' },
              efficiencyMetrics: {
                avgTokensPerStory: 45000,
                avgTokenPerLoc: 85,
                storyCycleTimeHours: 12,
                promptIterationsPerStory: 25,
                parallelizationEfficiencyPercent: 65,
                tokenEfficiencyRatio: 0.48,
              },
              qualityMetrics: {
                defectsPerStory: 2.3,
                defectLeakagePercent: 45,
                codeChurnPercent: 35,
                testCoveragePercent: 72,
                codeComplexityDeltaPercent: 15,
                criticalDefects: 8,
              },
              costMetrics: {
                costPerStory: 4.5,
                costPerAcceptedLoc: 0.12,
                storiesCompleted: 42,
                acceptedLoc: 8500,
                reworkCost: 2.8,
                netCost: 7.3,
              },
              sampleSize: 42,
              confidenceLevel: 'high',
            },
            {
              framework: { id: 'full', name: 'BA+Arch+Dev+QA' },
              efficiencyMetrics: {
                avgTokensPerStory: 62000,
                avgTokenPerLoc: 45,
                storyCycleTimeHours: 18,
                promptIterationsPerStory: 15,
                parallelizationEfficiencyPercent: 82,
                tokenEfficiencyRatio: 0.63,
              },
              qualityMetrics: {
                defectsPerStory: 0.8,
                defectLeakagePercent: 12,
                codeChurnPercent: 18,
                testCoveragePercent: 91,
                codeComplexityDeltaPercent: -5,
                criticalDefects: 1,
              },
              costMetrics: {
                costPerStory: 6.2,
                costPerAcceptedLoc: 0.06,
                storiesCompleted: 35,
                acceptedLoc: 12000,
                reworkCost: 0.95,
                netCost: 6.2,
              },
              sampleSize: 35,
              confidenceLevel: 'high',
            },
          ],
          aiInsights: [
            'Full framework reduces defect leakage by 73% for medium complexity stories',
            'Dev-only is 33% faster for low complexity stories with similar quality',
            'Full framework has 38% overhead but prevents $2.80 in rework per story',
            'Architect role prevents 2.1 defects per story on average',
            'BA reduces developer iterations by 40% (25 → 15 prompts)',
          ],
        });
      } finally {
        setLoading(false);
      }
    };

    if (activeTab === 'comparison' && projectId) {
      fetchComparisonData();
    }
  }, [activeTab, projectId, selectedFrameworks, complexityBand, dateRange]);

  const renderFrameworkComparisonTab = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted">Loading metrics...</div>
        </div>
      );
    }

    if (!comparisonData) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted">
            Select frameworks to compare
          </div>
        </div>
      );
    }

    const { comparisons, aiInsights } = comparisonData;

    return (
      <div className="space-y-8">
        {/* Filters */}
        <div className="bg-card border border-border rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-fg mb-2">
                Complexity Band
              </label>
              <select
                value={complexityBand}
                onChange={(e) => setComplexityBand(e.target.value)}
                className="px-4 py-2 border border-border rounded-md"
              >
                <option value="all">All</option>
                <option value="low">Low (1-2)</option>
                <option value="medium">Medium (3)</option>
                <option value="high">High (4-5)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-fg mb-2">
                Date Range
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 border border-border rounded-md"
              >
                <option value="last_7_days">Last 7 days</option>
                <option value="last_30_days">Last 30 days</option>
                <option value="last_90_days">Last 90 days</option>
                <option value="all_time">All time</option>
              </select>
            </div>
          </div>
        </div>

        {/* Efficiency Metrics */}
        <div className="bg-card border border-border rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
          <h3 className="text-lg font-semibold text-fg mb-4">
            A. Efficiency Metrics
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Metric
                  </th>
                  {comparisons.map((comp) => (
                    <th
                      key={comp.framework.id}
                      className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider"
                    >
                      {comp.framework.name}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Better
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-fg">
                    Avg tokens per story
                  </td>
                  {comparisons.map((comp) => (
                    <td
                      key={comp.framework.id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-fg"
                    >
                      {comp.efficiencyMetrics.avgTokensPerStory.toLocaleString()}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                    {comparisons[0].efficiencyMetrics.avgTokensPerStory <
                    comparisons[1]?.efficiencyMetrics.avgTokensPerStory
                      ? `${comparisons[0].framework.name} ↓`
                      : `${comparisons[1]?.framework.name} ↓`}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-fg">
                    Avg token per LOC
                  </td>
                  {comparisons.map((comp) => (
                    <td
                      key={comp.framework.id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-fg"
                    >
                      {comp.efficiencyMetrics.avgTokenPerLoc.toFixed(1)}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                    {comparisons[0].efficiencyMetrics.avgTokenPerLoc <
                    comparisons[1]?.efficiencyMetrics.avgTokenPerLoc
                      ? `${comparisons[0].framework.name} ✓`
                      : `${comparisons[1]?.framework.name} ✓`}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-fg">
                    Story cycle time (hours)
                  </td>
                  {comparisons.map((comp) => (
                    <td
                      key={comp.framework.id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-fg"
                    >
                      {comp.efficiencyMetrics.storyCycleTimeHours.toFixed(1)}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                    {comparisons[0].efficiencyMetrics.storyCycleTimeHours <
                    comparisons[1]?.efficiencyMetrics.storyCycleTimeHours
                      ? `${comparisons[0].framework.name} ↓`
                      : `${comparisons[1]?.framework.name} ↓`}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-fg">
                    Prompt iterations per story
                  </td>
                  {comparisons.map((comp) => (
                    <td
                      key={comp.framework.id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-fg"
                    >
                      {comp.efficiencyMetrics.promptIterationsPerStory.toFixed(1)}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                    {comparisons[0].efficiencyMetrics.promptIterationsPerStory <
                    comparisons[1]?.efficiencyMetrics.promptIterationsPerStory
                      ? `${comparisons[0].framework.name} ✓`
                      : `${comparisons[1]?.framework.name} ✓`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Quality Metrics */}
        <div className="bg-card border border-border rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
          <h3 className="text-lg font-semibold text-fg mb-4">
            B. Quality Metrics
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Metric
                  </th>
                  {comparisons.map((comp) => (
                    <th
                      key={comp.framework.id}
                      className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider"
                    >
                      {comp.framework.name}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Better
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-fg">
                    Defects per story
                  </td>
                  {comparisons.map((comp) => (
                    <td
                      key={comp.framework.id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-fg"
                    >
                      {comp.qualityMetrics.defectsPerStory.toFixed(1)}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                    {comparisons[0].qualityMetrics.defectsPerStory <
                    comparisons[1]?.qualityMetrics.defectsPerStory
                      ? `${comparisons[0].framework.name} ✓`
                      : `${comparisons[1]?.framework.name} ✓`}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-fg">
                    Defect leakage %
                  </td>
                  {comparisons.map((comp) => (
                    <td
                      key={comp.framework.id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-fg"
                    >
                      {comp.qualityMetrics.defectLeakagePercent.toFixed(0)}%
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                    {comparisons[0].qualityMetrics.defectLeakagePercent <
                    comparisons[1]?.qualityMetrics.defectLeakagePercent
                      ? `${comparisons[0].framework.name} ✓`
                      : `${comparisons[1]?.framework.name} ✓`}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-fg">
                    Code churn % (rework)
                  </td>
                  {comparisons.map((comp) => (
                    <td
                      key={comp.framework.id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-fg"
                    >
                      {comp.qualityMetrics.codeChurnPercent.toFixed(0)}%
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                    {comparisons[0].qualityMetrics.codeChurnPercent <
                    comparisons[1]?.qualityMetrics.codeChurnPercent
                      ? `${comparisons[0].framework.name} ✓`
                      : `${comparisons[1]?.framework.name} ✓`}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-fg">
                    Test coverage %
                  </td>
                  {comparisons.map((comp) => (
                    <td
                      key={comp.framework.id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-fg"
                    >
                      {comp.qualityMetrics.testCoveragePercent.toFixed(0)}%
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                    {comparisons[0].qualityMetrics.testCoveragePercent >
                    comparisons[1]?.qualityMetrics.testCoveragePercent
                      ? `${comparisons[0].framework.name} ✓`
                      : `${comparisons[1]?.framework.name} ✓`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Cost Metrics */}
        <div className="bg-card border border-border rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
          <h3 className="text-lg font-semibold text-fg mb-4">
            C. Cost & Value Metrics
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Metric
                  </th>
                  {comparisons.map((comp) => (
                    <th
                      key={comp.framework.id}
                      className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider"
                    >
                      {comp.framework.name}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Better
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-fg">
                    Cost per story ($)
                  </td>
                  {comparisons.map((comp) => (
                    <td
                      key={comp.framework.id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-fg"
                    >
                      ${comp.costMetrics.costPerStory.toFixed(2)}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                    {comparisons[0].costMetrics.costPerStory <
                    comparisons[1]?.costMetrics.costPerStory
                      ? `${comparisons[0].framework.name} ↓`
                      : `${comparisons[1]?.framework.name} ↓`}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-fg">
                    Cost per accepted LOC ($)
                  </td>
                  {comparisons.map((comp) => (
                    <td
                      key={comp.framework.id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-fg"
                    >
                      ${comp.costMetrics.costPerAcceptedLoc.toFixed(4)}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                    {comparisons[0].costMetrics.costPerAcceptedLoc <
                    comparisons[1]?.costMetrics.costPerAcceptedLoc
                      ? `${comparisons[0].framework.name} ✓`
                      : `${comparisons[1]?.framework.name} ✓`}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-fg">
                    Stories completed
                  </td>
                  {comparisons.map((comp) => (
                    <td
                      key={comp.framework.id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-fg"
                    >
                      {comp.costMetrics.storiesCompleted}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                    {comparisons[0].costMetrics.storiesCompleted >
                    comparisons[1]?.costMetrics.storiesCompleted
                      ? `${comparisons[0].framework.name} ↑`
                      : `${comparisons[1]?.framework.name} ↑`}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-fg">
                    Net cost (incl rework)
                  </td>
                  {comparisons.map((comp) => (
                    <td
                      key={comp.framework.id}
                      className="px-6 py-4 whitespace-nowrap text-sm text-fg"
                    >
                      ${comp.costMetrics.netCost.toFixed(2)}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                    {comparisons[0].costMetrics.netCost <
                    comparisons[1]?.costMetrics.netCost
                      ? `${comparisons[0].framework.name} ✓`
                      : `${comparisons[1]?.framework.name} ✓`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Insights */}
        <div className="bg-accent/10 border border-accent rounded-lg p-6">
          <h3 className="text-lg font-semibold text-accent-fg mb-4 flex items-center">
            <span className="mr-2">🤖</span>
            AI-Powered Insights
          </h3>
          <ul className="space-y-2">
            {aiInsights.map((insight, index) => (
              <li key={index} className="text-sm text-accent-fg flex items-start">
                <span className="mr-2">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-secondary py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-fg">
            Agent Performance & Effectiveness
          </h1>
          <p className="mt-2 text-sm text-muted">
            Project: {comparisonData?.projectName || 'Loading...'}
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-card border border-border rounded-lg shadow-md mb-6">
          <div className="border-b border-border">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('comparison')}
                className={`${
                  activeTab === 'comparison'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted hover:text-fg hover:border-border'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Framework Comparison
              </button>
              <button
                onClick={() => setActiveTab('story')}
                className={`${
                  activeTab === 'story'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted hover:text-fg hover:border-border'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Per-Story Execution
              </button>
              <button
                onClick={() => setActiveTab('agent')}
                className={`${
                  activeTab === 'agent'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted hover:text-fg hover:border-border'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Per-Agent Analytics
              </button>
              <button
                onClick={() => setActiveTab('weekly')}
                className={`${
                  activeTab === 'weekly'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted hover:text-fg hover:border-border'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Week-over-Week
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-secondary">
          {activeTab === 'comparison' && renderFrameworkComparisonTab()}
          {activeTab === 'story' && (
            <div className="bg-card border border-border rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
              <p className="text-muted">
                Per-story execution view coming soon...
              </p>
            </div>
          )}
          {activeTab === 'agent' && (
            <div className="bg-card border border-border rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
              <p className="text-muted">
                Per-agent analytics coming soon...
              </p>
            </div>
          )}
          {activeTab === 'weekly' && (
            <div className="bg-card border border-border rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
              <p className="text-muted">
                Week-over-week analysis coming soon...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentPerformanceView;
