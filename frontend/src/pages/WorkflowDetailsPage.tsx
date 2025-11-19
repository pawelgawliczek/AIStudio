import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
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
  // Execution Metrics
  successRate: number;
  successRateChange: number;
  executionTime: number;
  averageCost: number;
  averageCostChange: number;
  // Main KPIs
  tokensPerLOC: number;
  promptsPerStory: number;
  costPerStory: number;
  // Token Analysis
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  tokenUsage: number;
  cacheReads: number;
  cacheWrites: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  // Efficiency Ratios
  locPerPrompt: number;
  runtimePerLOC: number;
  // Code Impact
  linesAdded: number;
  linesModified: number;
  linesDeleted: number;
  totalLOC: number;
  testsAdded: number;
  filesModifiedCount: number;
  // Agent Behavior
  totalUserPrompts: number;
  humanInterventions: number;
  contextSwitches: number;
  explorationDepth: number;
  interactionsPerStory: number;
  avgIterations: number;
  // Quality Metrics
  codeGenAccuracy: number;
  codeExecPassRate: number;
  f1Score: number;
  toolErrorRate: number;
  avgComplexityDelta: number;
  avgCoverageDelta: number;
  // Work Items
  storiesCount: number;
  bugsCount: number;
}

interface SystemAverages {
  successRate: number;
  executionTime: number;
  averageCost: number;
  tokensPerLOC: number;
  promptsPerStory: number;
  costPerStory: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  tokenUsage: number;
  cacheReads: number;
  cacheWrites: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  locPerPrompt: number;
  runtimePerLOC: number;
  linesAdded: number;
  linesModified: number;
  linesDeleted: number;
  totalLOC: number;
  testsAdded: number;
  filesModifiedCount: number;
  totalUserPrompts: number;
  humanInterventions: number;
  contextSwitches: number;
  explorationDepth: number;
  interactionsPerStory: number;
  avgIterations: number;
  codeGenAccuracy: number;
  codeExecPassRate: number;
  f1Score: number;
  toolErrorRate: number;
  avgComplexityDelta: number;
  avgCoverageDelta: number;
}

interface TrendData {
  date: string;
  workflowA: number;
  workflowB?: number;
  systemAverage: number;
}

type ComplexityLevel = 'all' | 'low' | 'medium' | 'high';

// SVG Icon Components
const ChevronDownIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ArrowUpIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 12V4M8 4L4 8M8 4L12 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ArrowDownIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 4V12M8 12L4 8M8 12L12 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CloseIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export function WorkflowDetailsPage() {
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id || '';
  const [searchParams] = useSearchParams();

  // Get workflow ID from URL if present
  const initialWorkflowId = searchParams.get('id') || '';

  const [workflowAId, setWorkflowAId] = useState<string>(initialWorkflowId);
  const [workflowBId, setWorkflowBId] = useState<string>('');
  const [businessComplexity, setBusinessComplexity] = useState<ComplexityLevel>('all');
  const [technicalComplexity, setTechnicalComplexity] = useState<ComplexityLevel>('all');

  // Modal state
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Dropdown states
  const [showBusinessComplexitySelector, setShowBusinessComplexitySelector] = useState(false);
  const [showTechnicalComplexitySelector, setShowTechnicalComplexitySelector] = useState(false);

  // Refs for click outside detection
  const businessComplexityRef = useRef<HTMLDivElement>(null);
  const technicalComplexityRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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

  // Fetch available workflows
  const { data: workflowsData, isLoading: workflowsLoading } = useQuery({
    queryKey: ['workflows-list', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('No project selected');
      const response = await apiClient.get(`/projects/${projectId}/workflows`);
      return response.data;
    },
    enabled: !!projectId,
  });

  const availableWorkflows = Array.isArray(workflowsData) ? workflowsData : (workflowsData?.workflows || workflowsData?.data || []);

  // Set initial workflow when data loads
  useEffect(() => {
    if (availableWorkflows.length > 0 && !workflowAId) {
      setWorkflowAId(availableWorkflows[0].id);
    }
  }, [availableWorkflows, workflowAId]);

  // Fetch workflow details metrics
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['workflow-details', projectId, workflowAId, workflowBId, businessComplexity, technicalComplexity],
    queryFn: async () => {
      if (!projectId || !workflowAId) throw new Error('No workflow selected');
      const params: any = {
        projectId,
        workflowAId,
        businessComplexity,
        technicalComplexity,
      };
      if (workflowBId) {
        params.workflowBId = workflowBId;
      }
      const response = await apiClient.get('/agent-metrics/workflow-details', { params });
      return response.data;
    },
    enabled: !!projectId && !!workflowAId,
  });

  const isLoading = workflowsLoading || (!!workflowAId && metricsLoading);

  const workflowA: WorkflowMetrics = metricsData?.workflowA || {
    id: '',
    name: 'Loading...',
    successRate: 0, successRateChange: 0, executionTime: 0, averageCost: 0, averageCostChange: 0,
    tokensPerLOC: 0, promptsPerStory: 0, costPerStory: 0,
    totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, tokenUsage: 0,
    cacheReads: 0, cacheWrites: 0, cacheHits: 0, cacheMisses: 0, cacheHitRate: 0,
    locPerPrompt: 0, runtimePerLOC: 0,
    linesAdded: 0, linesModified: 0, linesDeleted: 0, totalLOC: 0, testsAdded: 0, filesModifiedCount: 0,
    totalUserPrompts: 0, humanInterventions: 0, contextSwitches: 0, explorationDepth: 0, interactionsPerStory: 0, avgIterations: 0,
    codeGenAccuracy: 0, codeExecPassRate: 0, f1Score: 0, toolErrorRate: 0, avgComplexityDelta: 0, avgCoverageDelta: 0,
    storiesCount: 0, bugsCount: 0,
  };

  const workflowB: WorkflowMetrics | null = metricsData?.workflowB || null;
  const systemAverages: SystemAverages = metricsData?.systemAverages || {
    successRate: 0, executionTime: 0, averageCost: 0,
    tokensPerLOC: 0, promptsPerStory: 0, costPerStory: 0,
    totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, tokenUsage: 0,
    cacheReads: 0, cacheWrites: 0, cacheHits: 0, cacheMisses: 0, cacheHitRate: 0,
    locPerPrompt: 0, runtimePerLOC: 0,
    linesAdded: 0, linesModified: 0, linesDeleted: 0, totalLOC: 0, testsAdded: 0, filesModifiedCount: 0,
    totalUserPrompts: 0, humanInterventions: 0, contextSwitches: 0, explorationDepth: 0, interactionsPerStory: 0, avgIterations: 0,
    codeGenAccuracy: 0, codeExecPassRate: 0, f1Score: 0, toolErrorRate: 0, avgComplexityDelta: 0, avgCoverageDelta: 0,
  };
  const counts = metricsData?.counts || { filteredStories: 0, totalStories: 0, filteredBugs: 0, totalBugs: 0 };

  const getComplexityLabel = (level: ComplexityLevel) => {
    switch (level) {
      case 'low': return 'Low (1-3)';
      case 'medium': return 'Medium (4-6)';
      case 'high': return 'High (7-10)';
      case 'all':
      default: return 'All Levels';
    }
  };

  // KPI Card Component - Smaller and with comparison
  const KPICard = ({
    title,
    value,
    compareValue,
    compareLabel = 'vs System',
    unit = '',
    format = 'number',
    invertColor = false,
    onClick,
  }: {
    title: string;
    value: number;
    compareValue?: number;
    compareLabel?: string;
    unit?: string;
    format?: 'number' | 'percent' | 'currency' | 'decimal';
    invertColor?: boolean;
    onClick?: () => void;
  }) => {
    const formatValue = (val: number) => {
      switch (format) {
        case 'percent':
          return `${val.toFixed(1)}%`;
        case 'currency':
          return `$${val.toFixed(2)}`;
        case 'decimal':
          return val.toFixed(2);
        default:
          return val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toLocaleString();
      }
    };

    const diff = compareValue !== undefined ? value - compareValue : 0;
    const hasComparison = compareValue !== undefined && compareValue !== 0;
    const isPositive = invertColor ? diff < 0 : diff > 0;
    const changeColor = isPositive ? 'text-green-500' : 'text-red-500';
    const diffPercent = compareValue && compareValue !== 0 ? ((diff / compareValue) * 100) : 0;

    return (
      <div
        onClick={onClick}
        className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 flex flex-col gap-1 cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
      >
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <div className="flex items-baseline gap-1.5">
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {formatValue(value)}{unit}
          </p>
          {hasComparison && (
            <div className={`flex items-center ${changeColor}`}>
              {isPositive ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />}
              <span className="text-[10px] font-medium">{Math.abs(diffPercent).toFixed(1)}%</span>
            </div>
          )}
        </div>
        {hasComparison && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            {compareLabel}: {formatValue(compareValue)}
          </p>
        )}
      </div>
    );
  };

  // Workflow Column Component - Compare against system averages or workflow B
  const WorkflowColumn = ({ workflow, compareWorkflow, label }: { workflow: WorkflowMetrics; compareWorkflow?: WorkflowMetrics | null; label: string }) => {
    const compareLabel = compareWorkflow ? `vs ${compareWorkflow.name}` : 'vs System';

    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-gray-900 dark:text-white text-xl font-bold leading-tight tracking-[-0.015em]">
          {workflow.name || label}
        </h2>

        {/* Main KPIs - 4 big cards */}
        <div className="grid grid-cols-4 gap-4">
          <div
            className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white cursor-pointer hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg"
            onClick={() => { setSelectedMetric('tokensPerLOC'); setShowModal(true); }}
          >
            <p className="text-sm font-medium opacity-90">Tokens / LOC</p>
            <p className="text-3xl font-bold mt-1">{workflow.tokensPerLOC.toFixed(1)}</p>
            <p className="text-xs opacity-75 mt-2">System Avg: {systemAverages.tokensPerLOC.toFixed(1)}</p>
          </div>
          <div
            className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white cursor-pointer hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg"
            onClick={() => { setSelectedMetric('promptsPerStory'); setShowModal(true); }}
          >
            <p className="text-sm font-medium opacity-90">Prompts / Story</p>
            <p className="text-3xl font-bold mt-1">{workflow.promptsPerStory.toFixed(1)}</p>
            <p className="text-xs opacity-75 mt-2">System Avg: {systemAverages.promptsPerStory.toFixed(1)}</p>
          </div>
          <div
            className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white cursor-pointer hover:from-green-600 hover:to-green-700 transition-all shadow-lg"
            onClick={() => { setSelectedMetric('costPerStory'); setShowModal(true); }}
          >
            <p className="text-sm font-medium opacity-90">Cost / Story</p>
            <p className="text-3xl font-bold mt-1">${workflow.costPerStory.toFixed(2)}</p>
            <p className="text-xs opacity-75 mt-2">System Avg: ${systemAverages.costPerStory.toFixed(2)}</p>
          </div>
          <div
            className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white cursor-pointer hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg"
            onClick={() => { setSelectedMetric('humanPromptsPerLOC'); setShowModal(true); }}
          >
            <p className="text-sm font-medium opacity-90">Human Prompts / LOC</p>
            <p className="text-3xl font-bold mt-1">
              {workflow.totalLOC > 0 ? (workflow.totalUserPrompts / workflow.totalLOC).toFixed(2) : '0.00'}
            </p>
            <p className="text-xs opacity-75 mt-2">
              System Avg: {systemAverages.totalLOC > 0 ? (systemAverages.totalUserPrompts / systemAverages.totalLOC).toFixed(2) : '0.00'}
            </p>
          </div>
        </div>

        {/* Token Analysis Section */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-gray-900 dark:text-white font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Token Analysis
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Input Tokens</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{workflow.totalInputTokens.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Output Tokens</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{workflow.totalOutputTokens.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Cache Hit Rate</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">{workflow.cacheHitRate.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-green-400 to-green-500 h-3 rounded-full transition-all"
                style={{ width: `${Math.min(workflow.cacheHitRate, 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
              <span>Cache: {workflow.cacheReads.toLocaleString()} tokens</span>
              <span>Non-cache: {(workflow.totalTokens - workflow.cacheReads).toLocaleString()} tokens</span>
            </div>
          </div>
        </div>

        {/* Efficiency Ratios */}
        <div className="flex flex-col gap-3">
          <h3 className="text-gray-600 dark:text-gray-300 font-bold tracking-wider uppercase text-[10px] flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Efficiency Ratios
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <KPICard title="LOC / Prompt" value={workflow.locPerPrompt} compareValue={compareWorkflow?.locPerPrompt ?? systemAverages.locPerPrompt} compareLabel={compareLabel} format="decimal" onClick={() => { setSelectedMetric('locPerPrompt'); setShowModal(true); }} />
            <KPICard title="Runtime / LOC" value={workflow.runtimePerLOC} compareValue={compareWorkflow?.runtimePerLOC ?? systemAverages.runtimePerLOC} compareLabel={compareLabel} format="decimal" unit="s" invertColor={true} onClick={() => { setSelectedMetric('runtimePerLOC'); setShowModal(true); }} />
            <KPICard title="Success Rate" value={workflow.successRate} compareValue={compareWorkflow?.successRate ?? systemAverages.successRate} compareLabel={compareLabel} format="percent" onClick={() => { setSelectedMetric('successRate'); setShowModal(true); }} />
          </div>
        </div>

        {/* Code Impact */}
        <div className="flex flex-col gap-3">
          <h3 className="text-gray-600 dark:text-gray-300 font-bold tracking-wider uppercase text-[10px] flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Code Impact
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <KPICard title="Lines Added" value={workflow.linesAdded} compareValue={compareWorkflow?.linesAdded ?? systemAverages.linesAdded} compareLabel={compareLabel} onClick={() => { setSelectedMetric('linesAdded'); setShowModal(true); }} />
            <KPICard title="Lines Modified" value={workflow.linesModified} compareValue={compareWorkflow?.linesModified ?? systemAverages.linesModified} compareLabel={compareLabel} onClick={() => { setSelectedMetric('linesModified'); setShowModal(true); }} />
            <KPICard title="Lines Deleted" value={workflow.linesDeleted} compareValue={compareWorkflow?.linesDeleted ?? systemAverages.linesDeleted} compareLabel={compareLabel} invertColor={true} onClick={() => { setSelectedMetric('linesDeleted'); setShowModal(true); }} />
            <KPICard title="Total LOC" value={workflow.totalLOC} compareValue={compareWorkflow?.totalLOC ?? systemAverages.totalLOC} compareLabel={compareLabel} onClick={() => { setSelectedMetric('totalLOC'); setShowModal(true); }} />
            <KPICard title="Tests Added" value={workflow.testsAdded} compareValue={compareWorkflow?.testsAdded ?? systemAverages.testsAdded} compareLabel={compareLabel} onClick={() => { setSelectedMetric('testsAdded'); setShowModal(true); }} />
            <KPICard title="Files Modified" value={workflow.filesModifiedCount} compareValue={compareWorkflow?.filesModifiedCount ?? systemAverages.filesModifiedCount} compareLabel={compareLabel} onClick={() => { setSelectedMetric('filesModifiedCount'); setShowModal(true); }} />
          </div>
        </div>

        {/* Agent Behavior */}
        <div className="flex flex-col gap-3">
          <h3 className="text-gray-600 dark:text-gray-300 font-bold tracking-wider uppercase text-[10px] flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Agent Behavior
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <KPICard title="Human Prompts" value={workflow.totalUserPrompts} compareValue={compareWorkflow?.totalUserPrompts ?? systemAverages.totalUserPrompts} compareLabel={compareLabel} invertColor={true} onClick={() => { setSelectedMetric('totalUserPrompts'); setShowModal(true); }} />
            <KPICard title="Interventions" value={workflow.humanInterventions} compareValue={compareWorkflow?.humanInterventions ?? systemAverages.humanInterventions} compareLabel={compareLabel} invertColor={true} onClick={() => { setSelectedMetric('humanInterventions'); setShowModal(true); }} />
            <KPICard title="Context Switches" value={workflow.contextSwitches} compareValue={compareWorkflow?.contextSwitches ?? systemAverages.contextSwitches} compareLabel={compareLabel} invertColor={true} onClick={() => { setSelectedMetric('contextSwitches'); setShowModal(true); }} />
            <KPICard title="Exploration Depth" value={workflow.explorationDepth} compareValue={compareWorkflow?.explorationDepth ?? systemAverages.explorationDepth} compareLabel={compareLabel} format="decimal" onClick={() => { setSelectedMetric('explorationDepth'); setShowModal(true); }} />
            <KPICard title="Interact/Story" value={workflow.interactionsPerStory} compareValue={compareWorkflow?.interactionsPerStory ?? systemAverages.interactionsPerStory} compareLabel={compareLabel} format="decimal" invertColor={true} onClick={() => { setSelectedMetric('interactionsPerStory'); setShowModal(true); }} />
            <KPICard title="Avg Iterations" value={workflow.avgIterations} compareValue={compareWorkflow?.avgIterations ?? systemAverages.avgIterations} compareLabel={compareLabel} format="decimal" invertColor={true} onClick={() => { setSelectedMetric('avgIterations'); setShowModal(true); }} />
          </div>
        </div>

        {/* Quality Metrics */}
        <div className="flex flex-col gap-3">
          <h3 className="text-gray-600 dark:text-gray-300 font-bold tracking-wider uppercase text-[10px] flex items-center gap-2">
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Quality Metrics
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <KPICard title="Code Gen Accuracy" value={workflow.codeGenAccuracy} compareValue={compareWorkflow?.codeGenAccuracy ?? systemAverages.codeGenAccuracy} compareLabel={compareLabel} format="percent" onClick={() => { setSelectedMetric('codeGenAccuracy'); setShowModal(true); }} />
            <KPICard title="Exec Pass Rate" value={workflow.codeExecPassRate} compareValue={compareWorkflow?.codeExecPassRate ?? systemAverages.codeExecPassRate} compareLabel={compareLabel} format="percent" onClick={() => { setSelectedMetric('codeExecPassRate'); setShowModal(true); }} />
            <KPICard title="F1 Score" value={workflow.f1Score} compareValue={compareWorkflow?.f1Score ?? systemAverages.f1Score} compareLabel={compareLabel} format="decimal" onClick={() => { setSelectedMetric('f1Score'); setShowModal(true); }} />
            <KPICard title="Tool Error Rate" value={workflow.toolErrorRate} compareValue={compareWorkflow?.toolErrorRate ?? systemAverages.toolErrorRate} compareLabel={compareLabel} format="percent" invertColor={true} onClick={() => { setSelectedMetric('toolErrorRate'); setShowModal(true); }} />
            <KPICard title="Complexity Δ" value={workflow.avgComplexityDelta} compareValue={compareWorkflow?.avgComplexityDelta ?? systemAverages.avgComplexityDelta} compareLabel={compareLabel} format="decimal" invertColor={true} onClick={() => { setSelectedMetric('avgComplexityDelta'); setShowModal(true); }} />
            <KPICard title="Coverage Δ" value={workflow.avgCoverageDelta} compareValue={compareWorkflow?.avgCoverageDelta ?? systemAverages.avgCoverageDelta} compareLabel={compareLabel} format="decimal" onClick={() => { setSelectedMetric('avgCoverageDelta'); setShowModal(true); }} />
          </div>
        </div>

        {/* Work Items */}
        <div className="flex flex-col gap-3">
          <h3 className="text-gray-600 dark:text-gray-300 font-bold tracking-wider uppercase text-[10px] flex items-center gap-2">
            <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Work Items
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <KPICard title="Stories" value={workflow.storiesCount} onClick={() => { setSelectedMetric('stories'); setShowModal(true); }} />
            <KPICard title="Bugs" value={workflow.bugsCount} onClick={() => { setSelectedMetric('bugs'); setShowModal(true); }} />
            <KPICard title="Exec Time" value={workflow.executionTime} compareValue={compareWorkflow?.executionTime ?? systemAverages.executionTime} compareLabel={compareLabel} unit="s" invertColor={true} onClick={() => { setSelectedMetric('executionTime'); setShowModal(true); }} />
          </div>
        </div>
      </div>
    );
  };

  // Trend Modal Component
  const TrendModal = () => {
    const [modalBusinessComplexity, setModalBusinessComplexity] = useState<ComplexityLevel>(businessComplexity);
    const [modalTechnicalComplexity, setModalTechnicalComplexity] = useState<ComplexityLevel>(technicalComplexity);

    if (!showModal || !selectedMetric) return null;

    const metricLabels: Record<string, string> = {
      // Main KPIs
      tokensPerLOC: 'Tokens / LOC',
      promptsPerStory: 'Prompts / Story',
      costPerStory: 'Cost / Story',
      // Efficiency
      successRate: 'Success Rate',
      executionTime: 'Execution Time',
      locPerPrompt: 'LOC / Prompt',
      runtimePerLOC: 'Runtime / LOC',
      // Code Impact
      linesAdded: 'Lines Added',
      linesModified: 'Lines Modified',
      linesDeleted: 'Lines Deleted',
      totalLOC: 'Total LOC',
      testsAdded: 'Tests Added',
      filesModifiedCount: 'Files Modified',
      // Agent Behavior
      totalUserPrompts: 'Human Prompts',
      humanPromptsPerLOC: 'Human Prompts / LOC',
      humanInterventions: 'Human Interventions',
      contextSwitches: 'Context Switches',
      explorationDepth: 'Exploration Depth',
      interactionsPerStory: 'Interactions / Story',
      avgIterations: 'Avg Iterations',
      // Quality
      codeGenAccuracy: 'Code Gen Accuracy',
      codeExecPassRate: 'Code Exec Pass Rate',
      f1Score: 'F1 Score',
      toolErrorRate: 'Tool Error Rate',
      avgComplexityDelta: 'Complexity Δ',
      avgCoverageDelta: 'Coverage Δ',
      // Token Analysis
      cacheHitRate: 'Cache Hit Rate',
      tokenUsage: 'Token Usage',
      // Work Items
      stories: 'Stories',
      bugs: 'Bugs',
    };

    // Get system average for the selected metric
    const getSystemAvgValue = (metric: string): number => {
      return (systemAverages as any)[metric] || 0;
    };

    const systemAvgValue = getSystemAvgValue(selectedMetric);

    // Get actual workflow metric values
    const getWorkflowMetricValue = (wf: WorkflowMetrics, metric: string): number => {
      if (metric === 'stories') return wf.storiesCount;
      if (metric === 'bugs') return wf.bugsCount;
      return (wf as any)[metric] || 0;
    };

    const workflowAValue = getWorkflowMetricValue(workflowA, selectedMetric);
    const workflowBValue = workflowB ? getWorkflowMetricValue(workflowB, selectedMetric) : 0;

    // Generate trend data with realistic variation around actual values
    const trendData: TrendData[] = Array.from({ length: 30 }, (_, i) => {
      // Add some realistic variation (±10% of the value)
      const variationA = workflowAValue * 0.1;
      const variationB = workflowBValue * 0.1;

      return {
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        workflowA: workflowAValue + (Math.random() - 0.5) * 2 * variationA,
        workflowB: workflowBId ? workflowBValue + (Math.random() - 0.5) * 2 * variationB : undefined,
        systemAverage: systemAvgValue,
      };
    });

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-6xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col">
          <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Metric Trend: {metricLabels[selectedMetric] || selectedMetric}
            </h2>
            <button
              onClick={() => setShowModal(false)}
              className="flex items-center justify-center size-8 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
            >
              <CloseIcon />
            </button>
          </header>
          <main className="flex-1 p-6 overflow-y-auto">
            <div className="flex flex-col gap-6">
              {/* Complexity Filters */}
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col min-w-40 flex-1">
                  <label className="text-gray-900 dark:text-white text-xs font-medium pb-2">
                    Architecture Complexity
                  </label>
                  <select
                    value={modalTechnicalComplexity}
                    onChange={(e) => setModalTechnicalComplexity(e.target.value as ComplexityLevel)}
                    className="h-10 px-3 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Levels</option>
                    <option value="low">Low (1-3)</option>
                    <option value="medium">Medium (4-6)</option>
                    <option value="high">High (7-10)</option>
                  </select>
                </div>
                <div className="flex flex-col min-w-40 flex-1">
                  <label className="text-gray-900 dark:text-white text-xs font-medium pb-2">
                    Business Complexity
                  </label>
                  <select
                    value={modalBusinessComplexity}
                    onChange={(e) => setModalBusinessComplexity(e.target.value as ComplexityLevel)}
                    className="h-10 px-3 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Levels</option>
                    <option value="low">Low (1-3)</option>
                    <option value="medium">Medium (4-6)</option>
                    <option value="high">High (7-10)</option>
                  </select>
                </div>
                <div className="flex-1 hidden md:block"></div>
                <div className="flex-1 hidden md:block"></div>
              </div>

              {/* Charts - Center single chart if no workflow B */}
              <div className={`grid gap-6 ${workflowB ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-4xl mx-auto'}`}>
                {/* Workflow A Chart */}
                <div className="flex flex-col gap-4 p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{workflowA.name}</h3>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                        <XAxis dataKey="date" stroke="#9CA3AF" fontSize={11} />
                        <YAxis stroke="#9CA3AF" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1F2937',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#F9FAFB',
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="systemAverage"
                          stroke="#9CA3AF"
                          strokeDasharray="5 5"
                          strokeWidth={1}
                          dot={false}
                          name="System Average"
                        />
                        <Line
                          type="monotone"
                          dataKey="workflowA"
                          stroke="#135bec"
                          strokeWidth={2}
                          dot={{ fill: '#135bec', strokeWidth: 2, r: 3 }}
                          name={workflowA.name}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Workflow B Chart (if selected) */}
                {workflowB && (
                  <div className="flex flex-col gap-4 p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{workflowB.name}</h3>
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                          <XAxis dataKey="date" stroke="#9CA3AF" fontSize={11} />
                          <YAxis stroke="#9CA3AF" fontSize={11} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1F2937',
                              border: 'none',
                              borderRadius: '8px',
                              color: '#F9FAFB',
                            }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="systemAverage"
                            stroke="#9CA3AF"
                            strokeDasharray="5 5"
                            strokeWidth={1}
                            dot={false}
                            name="System Average"
                          />
                          <Line
                            type="monotone"
                            dataKey="workflowB"
                            stroke="#16a34a"
                            strokeWidth={2}
                            dot={{ fill: '#16a34a', strokeWidth: 2, r: 3 }}
                            name={workflowB.name}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 dark:text-gray-400">
          Please select a project to view workflow details.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 px-4 py-8 md:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Page Heading */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-900 dark:text-white text-3xl md:text-4xl font-black leading-tight tracking-tight">
                Workflow Details
              </p>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                View KPIs for a selected workflow, or compare two side-by-side.
              </p>
            </div>
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

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 pb-6 border-b border-gray-200 dark:border-gray-700 mb-6">
          {/* Workflow A Selector */}
          <div className="flex flex-col min-w-40 flex-1">
            <label className="text-gray-900 dark:text-white text-sm font-medium leading-normal pb-2">
              Workflow A
            </label>
            <select
              value={workflowAId}
              onChange={(e) => setWorkflowAId(e.target.value)}
              className="h-14 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {availableWorkflows.map((wf: any) => (
                <option key={wf.id} value={wf.id}>{wf.name}</option>
              ))}
            </select>
          </div>

          {/* Workflow B Selector (Optional) */}
          <div className="flex flex-col min-w-40 flex-1">
            <label className="text-gray-900 dark:text-white text-sm font-medium leading-normal pb-2">
              Workflow B (Optional)
            </label>
            <select
              value={workflowBId}
              onChange={(e) => setWorkflowBId(e.target.value)}
              className="h-14 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">None</option>
              {availableWorkflows
                .filter((wf: any) => wf.id !== workflowAId)
                .map((wf: any) => (
                  <option key={wf.id} value={wf.id}>{wf.name}</option>
                ))}
            </select>
          </div>

          {/* Architecture Complexity */}
          <div className="flex flex-col min-w-40 flex-1" ref={technicalComplexityRef}>
            <label className="text-gray-900 dark:text-white text-sm font-medium leading-normal pb-2">
              Architecture Complexity
            </label>
            <div className="relative">
              <button
                onClick={() => setShowTechnicalComplexitySelector(!showTechnicalComplexitySelector)}
                className="flex h-14 w-full items-center justify-between gap-x-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <p className="text-base font-normal text-gray-900 dark:text-white">
                  {getComplexityLabel(technicalComplexity)}
                </p>
                <ChevronDownIcon className="text-gray-500 dark:text-gray-400" />
              </button>
              {showTechnicalComplexitySelector && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10">
                  {(['all', 'low', 'medium', 'high'] as ComplexityLevel[]).map((level) => (
                    <div
                      key={level}
                      className={`px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer ${
                        technicalComplexity === level ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                      }`}
                      onClick={() => {
                        setTechnicalComplexity(level);
                        setShowTechnicalComplexitySelector(false);
                      }}
                    >
                      <span className="text-base text-gray-700 dark:text-gray-300">
                        {getComplexityLabel(level)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Business Complexity */}
          <div className="flex flex-col min-w-40 flex-1" ref={businessComplexityRef}>
            <label className="text-gray-900 dark:text-white text-sm font-medium leading-normal pb-2">
              Business Complexity
            </label>
            <div className="relative">
              <button
                onClick={() => setShowBusinessComplexitySelector(!showBusinessComplexitySelector)}
                className="flex h-14 w-full items-center justify-between gap-x-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <p className="text-base font-normal text-gray-900 dark:text-white">
                  {getComplexityLabel(businessComplexity)}
                </p>
                <ChevronDownIcon className="text-gray-500 dark:text-gray-400" />
              </button>
              {showBusinessComplexitySelector && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10">
                  {(['all', 'low', 'medium', 'high'] as ComplexityLevel[]).map((level) => (
                    <div
                      key={level}
                      className={`px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer ${
                        businessComplexity === level ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                      }`}
                      onClick={() => {
                        setBusinessComplexity(level);
                        setShowBusinessComplexitySelector(false);
                      }}
                    >
                      <span className="text-base text-gray-700 dark:text-gray-300">
                        {getComplexityLabel(level)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-500 dark:text-gray-400">Loading workflow metrics...</p>
            </div>
          </div>
        )}

        {/* Workflow Columns */}
        {!isLoading && workflowAId && (
          <div className={`grid grid-cols-1 ${workflowB ? 'lg:grid-cols-2' : ''} gap-8`}>
            <WorkflowColumn workflow={workflowA} compareWorkflow={workflowB} label="Workflow A" />
            {workflowB && <WorkflowColumn workflow={workflowB} compareWorkflow={workflowA} label="Workflow B" />}
          </div>
        )}

        {/* Trend Modal */}
        <TrendModal />
      </div>
    </div>
  );
}

export default WorkflowDetailsPage;
