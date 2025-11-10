import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { StoryListPage } from './pages/StoryListPage';
import { StoryDetailPage } from './pages/StoryDetailPage';
import { PlanningView } from './pages/PlanningView';
import CodeQualityDashboard from './pages/CodeQualityDashboard';
import { ProjectProvider } from './context/ProjectContext';

function App() {
  return (
    <BrowserRouter>
      <ProjectProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="planning" element={<PlanningView />} />
            <Route path="code-quality/:projectId" element={<CodeQualityDashboard />} />
            <Route path="projects/:projectId/stories" element={<StoryListPage />} />
            <Route path="projects/:projectId/stories/:storyId" element={<StoryDetailPage />} />
          </Route>
        </Routes>
      </ProjectProvider>
    </BrowserRouter>
  );
}

export default App;
