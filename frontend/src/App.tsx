import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Toaster, ToastBar, toast } from 'react-hot-toast';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { PlanningView } from './pages/PlanningView';
import { EpicPlanningView } from './pages/EpicPlanningView';
import { StoryDetailPage } from './pages/StoryDetailPage';
import { TimelineView } from './pages/TimelineView';
import { UseCaseLibraryView } from './pages/UseCaseLibraryView';
import { AgentLibraryView } from './pages/AgentLibraryView';
import { AgentDetailPage } from './pages/AgentDetailPage';
import { TeamManagementView } from './pages/TeamManagementView';
import { TeamDetailPage } from './pages/TeamDetailPage';
import { TeamComparisonPage } from './pages/TeamComparisonPage';
import { TeamRunsListView } from './pages/TeamRunsListView';
import { WorkflowResultsView } from './pages/WorkflowResultsView';
import WorkflowExecutionMonitor from './pages/WorkflowExecutionMonitor';
import { PerformanceDashboard } from './pages/PerformanceDashboard';
import CodeQualityDashboard from './pages/CodeQualityDashboard';
import { DeploymentHistoryPage } from './pages/DeploymentHistoryPage';
import { BackupsPage } from './pages/BackupsPage';
import { TestExecutionHistoryPage } from './pages/TestExecutionHistoryPage';
import { TestExecutionDetailPage } from './pages/TestExecutionDetailPage';
import TestCaseCoverageDashboard from './pages/TestCaseCoverageDashboard';
import ComponentCoverageView from './pages/ComponentCoverageView';
import TeamDetailsPage from './pages/TeamDetailsPage';
import { AuthProvider } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';
import { useWorkflowToastNotifications } from './hooks/useWorkflowToastNotifications';

// Redirect components that preserve URL params (React Router v6 <Navigate> doesn't auto-substitute params)
const RedirectWithId = ({ to }: { to: string }) => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={to.replace(':id', id || '')} replace />;
};

const RedirectWithRunId = ({ to }: { to: string }) => {
  const { runId } = useParams<{ runId: string }>();
  return <Navigate to={to.replace(':runId', runId || '')} replace />;
};

function AppContent() {
  // ST-108: Initialize toast notifications for workflow events
  useWorkflowToastNotifications();

  return (
    <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="planning" element={<PlanningView />} />
              <Route path="epic-planning" element={<EpicPlanningView />} />
              <Route path="story/:storyKey" element={<StoryDetailPage />} />
              <Route path="stories/:storyKey" element={<StoryDetailPage />} />
              <Route path="timeline" element={<TimelineView />} />
              <Route path="use-cases" element={<UseCaseLibraryView />} />
              <Route path="code-quality/:projectId" element={<CodeQualityDashboard />} />
              <Route path="test-coverage/use-case/:useCaseId" element={<TestCaseCoverageDashboard />} />
              <Route path="test-coverage/project/:projectId" element={<ComponentCoverageView />} />
              {/* New user-friendly routes */}
              <Route path="agents" element={<AgentLibraryView />} />
              <Route path="agents/:id" element={<AgentDetailPage />} />
              <Route path="teams" element={<TeamManagementView />} />
              <Route path="teams/:id" element={<TeamDetailPage />} />
              <Route path="teams/:id/compare" element={<TeamComparisonPage />} />
              <Route path="team-runs" element={<TeamRunsListView />} />
              <Route path="team-runs/:runId/results" element={<WorkflowResultsView />} />
              <Route path="team-runs/:runId/monitor" element={<WorkflowExecutionMonitor />} />
              <Route path="analytics/performance" element={<PerformanceDashboard />} />
              <Route path="analytics/team-details" element={<TeamDetailsPage />} />
              <Route path="deployments" element={<DeploymentHistoryPage />} />
              <Route path="test-executions" element={<TestExecutionHistoryPage />} />
              <Route path="test-executions/:id" element={<TestExecutionDetailPage />} />
              <Route path="backups" element={<BackupsPage />} />

              {/* Backwards compatibility redirects (old routes → new routes) */}
              <Route path="components" element={<Navigate to="/agents" replace />} />
              <Route path="components/:id" element={<RedirectWithId to="/agents/:id" />} />
              <Route path="coordinators" element={<Navigate to="/teams" replace />} />
              <Route path="coordinators/:id" element={<Navigate to="/teams" replace />} />
              <Route path="workflows" element={<Navigate to="/teams" replace />} />
              <Route path="workflow-runs/:runId/results" element={<RedirectWithRunId to="/team-runs/:runId/results" />} />
              <Route path="workflow-runs/:runId/monitor" element={<RedirectWithRunId to="/team-runs/:runId/monitor" />} />
              <Route path="analytics/workflow-details" element={<Navigate to="/analytics/team-details" replace />} />
            </Route>
          </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProjectProvider>
          {/* ST-108: Toast notification configuration with theme support and close button */}
          <Toaster
            position="top-right"
            reverseOrder={false}
            gutter={12}
            toastOptions={{
              duration: 10000, // Default 10s for better readability
              className: 'toast-theme-aware',
              style: {
                maxWidth: '420px',
                padding: '16px',
                borderRadius: '12px',
                background: 'var(--card)',
                color: 'var(--fg)',
                border: '1px solid var(--border)',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
                fontSize: '14px',
                lineHeight: '1.5',
              },
              success: {
                duration: 12000, // 12s for success messages
                iconTheme: { primary: '#10b981', secondary: 'var(--card)' },
                style: {
                  borderLeft: '4px solid #10b981',
                },
              },
              error: {
                duration: 15000, // 15s for errors (need time to read)
                iconTheme: { primary: '#ef4444', secondary: 'var(--card)' },
                style: {
                  borderLeft: '4px solid #ef4444',
                },
              },
            }}
            containerStyle={{
              top: 80, // Below navbar
            }}
          >
            {(t) => (
              <ToastBar toast={t}>
                {({ icon, message }) => (
                  <div className="flex items-start gap-3 w-full">
                    {icon}
                    <div className="flex-1 min-w-0">{message}</div>
                    {t.type !== 'loading' && (
                      <button
                        onClick={() => toast.dismiss(t.id)}
                        className="flex-shrink-0 p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        aria-label="Dismiss notification"
                      >
                        <XMarkIcon className="h-4 w-4 text-muted" />
                      </button>
                    )}
                  </div>
                )}
              </ToastBar>
            )}
          </Toaster>
          <AppContent />
        </ProjectProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
