import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { PlanningView } from './pages/PlanningView';
import { EpicPlanningView } from './pages/EpicPlanningView';
import { StoryDetailPage } from './pages/StoryDetailPage';
import { TimelineView } from './pages/TimelineView';
import { UseCaseLibraryView } from './pages/UseCaseLibraryView';
import { LayersComponentsPage } from './pages/LayersComponentsPage';
import { AgentLibraryView } from './pages/AgentLibraryView';
import { AgentDetailPage } from './pages/AgentDetailPage';
import { ProjectManagerLibraryView } from './pages/ProjectManagerLibraryView';
import { ProjectManagerDetailPage } from './pages/ProjectManagerDetailPage';
import { TeamManagementView } from './pages/TeamManagementView';
import { WorkflowResultsView } from './pages/WorkflowResultsView';
import WorkflowExecutionMonitor from './pages/WorkflowExecutionMonitor';
import { PerformanceDashboard } from './pages/PerformanceDashboard';
import CodeQualityDashboard from './pages/CodeQualityDashboard';
import TestCaseCoverageDashboard from './pages/TestCaseCoverageDashboard';
import ComponentCoverageView from './pages/ComponentCoverageView';
import TeamDetailsPage from './pages/TeamDetailsPage';
import { AuthProvider } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProjectProvider>
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
              <Route path="layers-components" element={<LayersComponentsPage />} />
              {/* New user-friendly routes */}
              <Route path="agents" element={<AgentLibraryView />} />
              <Route path="agents/:id" element={<AgentDetailPage />} />
              <Route path="project-managers" element={<ProjectManagerLibraryView />} />
              <Route path="project-managers/:id" element={<ProjectManagerDetailPage />} />
              <Route path="teams" element={<TeamManagementView />} />
              <Route path="team-runs/:runId/results" element={<WorkflowResultsView />} />
              <Route path="team-runs/:runId/monitor" element={<WorkflowExecutionMonitor />} />
              <Route path="analytics/performance" element={<PerformanceDashboard />} />
              <Route path="analytics/team-details" element={<TeamDetailsPage />} />

              {/* Backwards compatibility redirects (old routes → new routes) */}
              <Route path="components" element={<Navigate to="/agents" replace />} />
              <Route path="components/:id" element={<Navigate to="/agents/:id" replace />} />
              <Route path="coordinators" element={<Navigate to="/project-managers" replace />} />
              <Route path="coordinators/:id" element={<Navigate to="/project-managers/:id" replace />} />
              <Route path="workflows" element={<Navigate to="/teams" replace />} />
              <Route path="workflow-runs/:runId/results" element={<Navigate to="/team-runs/:runId/results" replace />} />
              <Route path="workflow-runs/:runId/monitor" element={<Navigate to="/team-runs/:runId/monitor" replace />} />
              <Route path="analytics/workflow-details" element={<Navigate to="/analytics/team-details" replace />} />
            </Route>
          </Routes>
        </ProjectProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
