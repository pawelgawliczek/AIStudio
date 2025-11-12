import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { PlanningView } from './pages/PlanningView';
import { EpicPlanningView } from './pages/EpicPlanningView';
import { TimelineView } from './pages/TimelineView';
import { UseCaseLibraryView } from './pages/UseCaseLibraryView';
import { LayersComponentsPage } from './pages/LayersComponentsPage';
import { ComponentLibraryView } from './pages/ComponentLibraryView';
import { CoordinatorLibraryView } from './pages/CoordinatorLibraryView';
import { WorkflowManagementView } from './pages/WorkflowManagementView';
import CodeQualityDashboard from './pages/CodeQualityDashboard';
import AgentPerformanceView from './pages/AgentPerformanceView';
import TestCaseCoverageDashboard from './pages/TestCaseCoverageDashboard';
import ComponentCoverageView from './pages/ComponentCoverageView';
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
              <Route path="timeline" element={<TimelineView />} />
              <Route path="use-cases" element={<UseCaseLibraryView />} />
              <Route path="code-quality/:projectId" element={<CodeQualityDashboard />} />
              <Route path="agent-performance/:projectId" element={<AgentPerformanceView />} />
              <Route path="test-coverage/use-case/:useCaseId" element={<TestCaseCoverageDashboard />} />
              <Route path="test-coverage/project/:projectId" element={<ComponentCoverageView />} />
              <Route path="layers-components" element={<LayersComponentsPage />} />
              <Route path="components" element={<ComponentLibraryView />} />
              <Route path="coordinators" element={<CoordinatorLibraryView />} />
              <Route path="workflows" element={<WorkflowManagementView />} />
            </Route>
          </Routes>
        </ProjectProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
