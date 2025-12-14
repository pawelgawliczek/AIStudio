import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Dialog, Transition, Tab } from '@headlessui/react';
import { Fragment } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChartBarIcon,
  RectangleStackIcon,
} from '@heroicons/react/24/outline';
import { projectsService } from '../services/projects.service';
import { TaxonomyManager } from '../components/project/TaxonomyManager';
import type { Project } from '../types';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Fetch all projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.getAll(),
  });

  // Create project mutation
  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      projectsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setCreateModalOpen(false);
    },
  });

  // Update project mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string } }) =>
      projectsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setEditModalOpen(false);
      setEditingProject(null);
    },
  });

  // Delete project mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setEditModalOpen(true);
  };

  const handleDelete = async (project: Project) => {
    if (
      confirm(
        `Are you sure you want to delete project "${project.name}"? This action cannot be undone and will delete all associated data.`
      )
    ) {
      try {
        await deleteMutation.mutateAsync(project.id);
      } catch (error: any) {
        alert(error.message || 'Failed to delete project');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-fg">Projects</h1>
          <p className="mt-1 text-sm text-muted">
            Manage your software development projects
          </p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-lg">
          <RectangleStackIcon className="mx-auto h-12 w-12 text-muted" />
          <h3 className="mt-2 text-sm font-medium text-fg">No projects</h3>
          <p className="mt-1 text-sm text-muted">Get started by creating a new project.</p>
          <div className="mt-6">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              New Project
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-card border border-border rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-fg truncate">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="mt-1 text-sm text-muted line-clamp-2">
                        {project.description}
                      </p>
                    )}
                  </div>
                </div>

                {project._count && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="flex items-center">
                      <ChartBarIcon className="h-5 w-5 text-muted mr-2" />
                      <div>
                        <div className="text-xs text-muted">Epics</div>
                        <div className="text-lg font-semibold text-fg">
                          {project._count.epics}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <RectangleStackIcon className="h-5 w-5 text-muted mr-2" />
                      <div>
                        <div className="text-xs text-muted">Stories</div>
                        <div className="text-lg font-semibold text-fg">
                          {project._count.stories}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6">
                  <button
                    onClick={() => navigate(`/planning?projectId=${project.id}`)}
                    className="w-full inline-flex justify-center items-center px-3 py-2 border border-border text-sm font-medium rounded-md text-fg bg-card hover:bg-muted/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Open Planning
                  </button>
                </div>

                <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
                  <div className="text-xs text-muted">
                    Created {new Date(project.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(project)}
                      className="p-1 text-muted hover:text-indigo-600 focus:outline-none"
                      title="Edit project"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(project)}
                      className="p-1 text-muted hover:text-red-600 focus:outline-none"
                      title="Delete project"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <ProjectModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
      />

      {/* Edit Project Modal */}
      {editingProject && (
        <ProjectModal
          open={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setEditingProject(null);
          }}
          onSubmit={(data) =>
            updateMutation.mutate({ id: editingProject.id, data })
          }
          project={editingProject}
          isLoading={updateMutation.isPending}
        />
      )}
    </div>
  );
}

// Project Modal Component
interface ProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string }) => void;
  project?: Project;
  isLoading?: boolean;
}

function ProjectModal({
  open,
  onClose,
  onSubmit,
  project,
  isLoading = false,
}: ProjectModalProps) {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);

  // Reset form and tab when modal state changes
  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
    } else {
      setName('');
      setDescription('');
    }
    setSelectedTabIndex(0);
  }, [project, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, description });
    if (!project) {
      setName('');
      setDescription('');
    }
  };

  // Reusable form fields JSX
  const formFields = (
    <>
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-fg"
        >
          Project Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder="My Awesome Project"
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-fg"
        >
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder="Describe your project..."
        />
      </div>
    </>
  );

  // Reusable form buttons JSX
  const formButtons = (
    <div className="mt-5 sm:mt-6 flex gap-3">
      <button
        type="button"
        onClick={onClose}
        disabled={isLoading}
        className="flex-1 inline-flex justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-fg shadow-sm hover:bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isLoading}
        className="flex-1 inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {isLoading
          ? 'Saving...'
          : project
          ? 'Update Project'
          : 'Create Project'}
      </button>
    </div>
  );

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-bg-secondary0 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-card px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6 max-h-[90vh] overflow-y-auto">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-semibold leading-6 text-fg mb-4"
                >
                  {project ? 'Project Settings' : 'Create New Project'}
                </Dialog.Title>

                {/* Create mode: Simple form without tabs */}
                {!project ? (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {formFields}
                    {formButtons}
                  </form>
                ) : (
                  /* Edit mode: Tabbed interface */
                  <Tab.Group selectedIndex={selectedTabIndex} onChange={setSelectedTabIndex}>
                    <Tab.List className="flex space-x-1 rounded-xl bg-accent/10 p-1 mb-4">
                      <Tab
                        className={({ selected }) =>
                          classNames(
                            'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                            'ring-white ring-opacity-60 ring-offset-2 ring-offset-accent focus:outline-none focus:ring-2',
                            selected
                              ? 'bg-card shadow text-accent'
                              : 'text-accent hover:bg-card/50 hover:text-accent'
                          )
                        }
                      >
                        General Settings
                      </Tab>
                      <Tab
                        className={({ selected }) =>
                          classNames(
                            'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                            'ring-white ring-opacity-60 ring-offset-2 ring-offset-accent focus:outline-none focus:ring-2',
                            selected
                              ? 'bg-card shadow text-accent'
                              : 'text-accent hover:bg-card/50 hover:text-accent'
                          )
                        }
                      >
                        Taxonomy Settings
                      </Tab>
                    </Tab.List>
                    <Tab.Panels>
                      {/* General Settings Tab */}
                      <Tab.Panel>
                        <form onSubmit={handleSubmit} className="space-y-4">
                          {formFields}
                          {formButtons}
                        </form>
                      </Tab.Panel>
                      {/* Taxonomy Settings Tab */}
                      <Tab.Panel>
                        <div className="min-h-[300px]">
                          <TaxonomyManager projectId={project.id} />
                        </div>
                        {/* Close button for Taxonomy tab */}
                        <div className="mt-5 sm:mt-6">
                          <button
                            type="button"
                            onClick={onClose}
                            className="w-full inline-flex justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-fg shadow-sm hover:bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            Close
                          </button>
                        </div>
                      </Tab.Panel>
                    </Tab.Panels>
                  </Tab.Group>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
