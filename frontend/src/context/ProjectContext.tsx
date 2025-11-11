import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Project } from '../types';
import { projectsService } from '../services/projects.service';
import { useAuth } from './AuthContext';

interface ProjectContextType {
  projects: Project[];
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  isLoading: boolean;
  error: string | null;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, loading: authLoading } = useAuth();

  const refreshProjects = async () => {
    if (!isAuthenticated) {
      console.log('[ProjectContext] Not authenticated, skipping refresh');
      return;
    }

    try {
      console.log('[ProjectContext] Starting refreshProjects...');
      setIsLoading(true);
      setError(null);
      const data = await projectsService.getAll();
      console.log('[ProjectContext] Got projects:', data);
      setProjects(data);

      // If there's a selected project, update it with fresh data
      if (selectedProject) {
        const updated = data.find(p => p.id === selectedProject.id);
        if (updated) {
          setSelectedProject(updated);
        } else {
          // Project was deleted, clear selection
          setSelectedProject(null);
          localStorage.removeItem('selectedProjectId');
        }
      } else {
        // Try to restore selected project from localStorage
        const savedProjectId = localStorage.getItem('selectedProjectId');
        if (savedProjectId) {
          const project = data.find(p => p.id === savedProjectId);
          if (project) {
            setSelectedProject(project);
          }
        } else if (data.length > 0) {
          // Auto-select first project if none selected
          console.log('[ProjectContext] Auto-selecting first project:', data[0]);
          setSelectedProject(data[0]);
          localStorage.setItem('selectedProjectId', data[0].id);
        } else {
          console.log('[ProjectContext] No projects available');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load projects');
      console.error('[ProjectContext] Error loading projects:', err);
    } finally {
      console.log('[ProjectContext] Finished refreshProjects, isLoading -> false');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      refreshProjects();
    }
  }, [authLoading, isAuthenticated]);

  const handleSetSelectedProject = (project: Project | null) => {
    setSelectedProject(project);
    if (project) {
      localStorage.setItem('selectedProjectId', project.id);
    } else {
      localStorage.removeItem('selectedProjectId');
    }
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        selectedProject,
        setSelectedProject: handleSetSelectedProject,
        isLoading,
        error,
        refreshProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
