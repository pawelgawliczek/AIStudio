import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layer, Component, LayerStatus, ComponentStatus } from '../types';
import { API_BASE_URL } from '../config';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Dialog, Transition, Tab } from '@headlessui/react';
import { Fragment } from 'react';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export function LayersComponentsPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || '';
  const queryClient = useQueryClient();

  const [layerModalOpen, setLayerModalOpen] = useState(false);
  const [componentModalOpen, setComponentModalOpen] = useState(false);
  const [editingLayer, setEditingLayer] = useState<Layer | null>(null);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);

  // Fetch layers
  const { data: layers = [], isLoading: layersLoading } = useQuery({
    queryKey: ['layers', projectId],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/layers?projectId=${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch layers');
      return response.json();
    },
    enabled: !!projectId,
  });

  // Fetch components
  const { data: components = [], isLoading: componentsLoading } = useQuery({
    queryKey: ['components', projectId],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/components?projectId=${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch components');
      return response.json();
    },
    enabled: !!projectId,
  });

  // Delete layer mutation
  const deleteLayerMutation = useMutation({
    mutationFn: async (layerId: string) => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/layers/${layerId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete layer');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['layers'] });
    },
  });

  // Delete component mutation
  const deleteComponentMutation = useMutation({
    mutationFn: async (componentId: string) => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/components/${componentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete component');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
    },
  });

  const handleEditLayer = (layer: Layer) => {
    setEditingLayer(layer);
    setLayerModalOpen(true);
  };

  const handleEditComponent = (component: Component) => {
    setEditingComponent(component);
    setComponentModalOpen(true);
  };

  const handleDeleteLayer = async (layer: Layer) => {
    if (confirm(`Are you sure you want to delete "${layer.name}"? This action cannot be undone.`)) {
      try {
        await deleteLayerMutation.mutateAsync(layer.id);
      } catch (error: any) {
        alert(error.message);
      }
    }
  };

  const handleDeleteComponent = async (component: Component) => {
    if (confirm(`Are you sure you want to delete "${component.name}"? This action cannot be undone.`)) {
      try {
        await deleteComponentMutation.mutateAsync(component.id);
      } catch (error: any) {
        alert(error.message);
      }
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Layers & Components</h1>
        <p className="mt-1 text-sm text-muted">
          Manage architectural layers and business components for your project
        </p>
      </div>

      <Tab.Group>
        <Tab.List className="flex space-x-1 rounded-xl bg-accent/10 p-1 mb-6">
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
            Architecture Overview
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
            Layers
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
            Components
          </Tab>
        </Tab.List>
        <Tab.Panels>
          {/* Architecture Overview Tab */}
          <Tab.Panel>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-semibold text-fg">Architecture Overview</h2>
                <p className="mt-1 text-sm text-muted">
                  View layers with their associated components
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingLayer(null);
                    setLayerModalOpen(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md shadow-sm text-fg bg-bg-secondary hover:bg-accent hover:text-accent-fg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-all"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Add Layer
                </button>
                <button
                  onClick={() => {
                    setEditingComponent(null);
                    setComponentModalOpen(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-accent-fg bg-accent hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-all"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Add Component
                </button>
              </div>
            </div>

            {layersLoading || componentsLoading ? (
              <div className="text-center py-12 text-muted">Loading architecture...</div>
            ) : layers.length === 0 ? (
              <div className="text-center py-12 bg-bg-secondary rounded-lg border-2 border-dashed border-border">
                <p className="text-muted">No layers configured yet</p>
                <button
                  onClick={() => {
                    setEditingLayer(null);
                    setLayerModalOpen(true);
                  }}
                  className="mt-4 text-accent hover:text-accent-dark"
                >
                  Create your first layer
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {layers
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map((layer) => {
                    // Get components for this layer
                    const layerComponents = components.filter((comp) =>
                      comp.layers?.some((cl) => cl.layer.id === layer.id)
                    );

                    return (
                      <div
                        key={layer.id}
                        className="bg-card rounded-lg border border-border overflow-hidden shadow-md"
                      >
                        {/* Layer Header */}
                        <div
                          className="px-6 py-4 border-l-4"
                          style={{ borderLeftColor: layer.color || '#3B82F6', backgroundColor: `${layer.color}08` }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              {layer.icon && <span className="text-3xl">{layer.icon}</span>}
                              <div>
                                <h3 className="text-lg font-semibold text-fg">{layer.name}</h3>
                                {layer.description && (
                                  <p className="mt-1 text-sm text-muted">{layer.description}</p>
                                )}
                                {layer.techStack && layer.techStack.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {layer.techStack.map((tech, idx) => (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20"
                                      >
                                        {tech}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span
                                className={classNames(
                                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                                  layer.status === 'active'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                )}
                              >
                                {layer.status}
                              </span>
                              <button
                                onClick={() => handleEditLayer(layer)}
                                className="p-1.5 text-muted hover:text-accent rounded-md hover:bg-bg-secondary"
                                title="Edit layer"
                              >
                                <PencilIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleDeleteLayer(layer)}
                                className="p-1.5 text-muted hover:text-red-600 rounded-md hover:bg-bg-secondary"
                                title="Delete layer"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Components in this Layer */}
                        <div className="px-6 py-4 bg-bg-secondary">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-medium text-fg">
                              Components ({layerComponents.length})
                            </h4>
                            <button
                              onClick={() => {
                                setEditingComponent({
                                  ...({} as Component),
                                  layers: [{ layer }],
                                } as any);
                                setComponentModalOpen(true);
                              }}
                              className="text-sm text-accent hover:text-accent-dark"
                            >
                              + Add component to layer
                            </button>
                          </div>

                          {layerComponents.length === 0 ? (
                            <p className="text-sm text-muted italic">No components in this layer yet</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {layerComponents
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((component) => (
                                  <div
                                    key={component.id}
                                    className="bg-card rounded-lg border border-border p-3 hover:shadow-md transition-shadow group"
                                    style={{
                                      borderLeftWidth: '3px',
                                      borderLeftColor: component.color || '#10B981',
                                    }}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                                        {component.icon && (
                                          <span className="text-xl flex-shrink-0">{component.icon}</span>
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <h5 className="text-sm font-semibold text-fg truncate">
                                            {component.name}
                                          </h5>
                                          {component.description && (
                                            <p className="mt-0.5 text-xs text-muted line-clamp-2">
                                              {component.description}
                                            </p>
                                          )}
                                          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                                            {component._count && (
                                              <>
                                                <span>{component._count.storyComponents} stories</span>
                                                <span>•</span>
                                                <span>{component._count.useCases} use cases</span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => handleEditComponent(component)}
                                          className="p-1 text-muted hover:text-accent"
                                          title="Edit component"
                                        >
                                          <PencilIcon className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteComponent(component)}
                                          className="p-1 text-muted hover:text-red-600"
                                          title="Delete component"
                                        >
                                          <TrashIcon className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                    {component.status && component.status !== 'active' && (
                                      <span
                                        className={classNames(
                                          'mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                                          component.status === 'planning'
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : 'bg-gray-100 text-gray-800'
                                        )}
                                      >
                                        {component.status}
                                      </span>
                                    )}
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </Tab.Panel>

          {/* Layers Tab */}
          <Tab.Panel>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-fg">Architectural Layers</h2>
              <button
                onClick={() => {
                  setEditingLayer(null);
                  setLayerModalOpen(true);
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-accent-fg bg-accent hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-all"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add Layer
              </button>
            </div>

            {layersLoading ? (
              <div className="text-center py-12 text-muted">Loading layers...</div>
            ) : layers.length === 0 ? (
              <div className="text-center py-12 bg-bg-secondary rounded-lg border-2 border-dashed border-border">
                <p className="text-muted">No layers configured yet</p>
                <button
                  onClick={() => {
                    setEditingLayer(null);
                    setLayerModalOpen(true);
                  }}
                  className="mt-4 text-accent hover:text-accent-dark"
                >
                  Create your first layer
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {layers
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map((layer) => (
                    <div
                      key={layer.id}
                      className="bg-card rounded-lg border border-border p-4 hover:shadow-md transition-shadow"
                      style={{ borderLeftWidth: '4px', borderLeftColor: layer.color || '#3B82F6' }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          {layer.icon && <span className="text-2xl">{layer.icon}</span>}
                          <div>
                            <h3 className="text-sm font-semibold text-fg">{layer.name}</h3>
                            <span
                              className={classNames(
                                'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                                layer.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              )}
                            >
                              {layer.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleEditLayer(layer)}
                            className="p-1 text-muted hover:text-accent"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteLayer(layer)}
                            className="p-1 text-muted hover:text-red-600"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {layer.description && (
                        <p className="mt-2 text-xs text-muted">{layer.description}</p>
                      )}
                      {layer.techStack && layer.techStack.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {layer.techStack.map((tech, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                      {layer._count && (
                        <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs text-muted">
                          <div>Stories: {layer._count.storyLayers}</div>
                          <div>Components: {layer._count.componentLayers}</div>
                          <div>Use Cases: {layer._count.useCases}</div>
                          <div>Test Cases: {layer._count.testCases}</div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </Tab.Panel>

          {/* Components Tab */}
          <Tab.Panel>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-fg">Business Components</h2>
              <button
                onClick={() => {
                  setEditingComponent(null);
                  setComponentModalOpen(true);
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-accent-fg bg-accent hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-all"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add Component
              </button>
            </div>

            {componentsLoading ? (
              <div className="text-center py-12 text-muted">Loading components...</div>
            ) : components.length === 0 ? (
              <div className="text-center py-12 bg-bg-secondary rounded-lg border-2 border-dashed border-border">
                <p className="text-muted">No components configured yet</p>
                <button
                  onClick={() => {
                    setEditingComponent(null);
                    setComponentModalOpen(true);
                  }}
                  className="mt-4 text-accent hover:text-accent-dark"
                >
                  Create your first component
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {components
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((component) => (
                    <div
                      key={component.id}
                      className="bg-card rounded-lg border border-border p-4 hover:shadow-md transition-shadow"
                      style={{ borderLeftWidth: '4px', borderLeftColor: component.color || '#10B981' }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          {component.icon && <span className="text-2xl">{component.icon}</span>}
                          <div>
                            <h3 className="text-sm font-semibold text-fg">{component.name}</h3>
                            <span
                              className={classNames(
                                'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                                component.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : component.status === 'planning'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              )}
                            >
                              {component.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleEditComponent(component)}
                            className="p-1 text-muted hover:text-accent"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteComponent(component)}
                            className="p-1 text-muted hover:text-red-600"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {component.description && (
                        <p className="mt-2 text-xs text-muted">{component.description}</p>
                      )}
                      {component.owner && (
                        <p className="mt-2 text-xs text-muted">Owner: {component.owner.name}</p>
                      )}
                      {component.layers && component.layers.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {component.layers.map((cl) => (
                            <span
                              key={cl.layer.id}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20"
                            >
                              {cl.layer.icon} {cl.layer.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {component._count && (
                        <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs text-muted">
                          <div>Stories: {component._count.storyComponents}</div>
                          <div>Use Cases: {component._count.useCases}</div>
                          <div>Test Cases: {component._count.testCases}</div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>

      {/* Layer Modal (Create/Edit) */}
      <LayerModal
        open={layerModalOpen}
        onClose={() => {
          setLayerModalOpen(false);
          setEditingLayer(null);
        }}
        layer={editingLayer}
        projectId={projectId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['layers'] });
          setLayerModalOpen(false);
          setEditingLayer(null);
        }}
      />

      {/* Component Modal (Create/Edit) */}
      <ComponentModal
        open={componentModalOpen}
        onClose={() => {
          setComponentModalOpen(false);
          setEditingComponent(null);
        }}
        component={editingComponent}
        projectId={projectId}
        layers={layers}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['components'] });
          setComponentModalOpen(false);
          setEditingComponent(null);
        }}
      />
    </div>
  );
}

// Layer Modal Component
interface LayerModalProps {
  open: boolean;
  onClose: () => void;
  layer: Layer | null;
  projectId: string;
  onSuccess: () => void;
}

function LayerModal({ open, onClose, layer, projectId, onSuccess }: LayerModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [techStack, setTechStack] = useState('');
  const [orderIndex, setOrderIndex] = useState(1);
  const [color, setColor] = useState('#3B82F6');
  const [icon, setIcon] = useState('');
  const [status, setStatus] = useState<LayerStatus>('active');

  useEffect(() => {
    if (layer) {
      setName(layer.name);
      setDescription(layer.description || '');
      setTechStack((layer.techStack || []).join(', '));
      setOrderIndex(layer.orderIndex);
      setColor(layer.color || '#3B82F6');
      setIcon(layer.icon || '');
      setStatus(layer.status);
    } else {
      setName('');
      setDescription('');
      setTechStack('');
      setOrderIndex(1);
      setColor('#3B82F6');
      setIcon('');
      setStatus('active');
    }
  }, [layer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('accessToken');
    const data = {
      projectId,
      name,
      description,
      techStack: techStack.split(',').map(t => t.trim()).filter(Boolean),
      orderIndex,
      color,
      icon,
      status,
    };

    const url = layer ? `${API_BASE_URL}/layers/${layer.id}` : `${API_BASE_URL}/layers`;
    const method = layer ? 'PATCH' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save layer');
      }

      onSuccess();
    } catch (error: any) {
      alert(error.message);
    }
  };

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
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-card px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-fg mb-4">
                  {layer ? 'Edit Layer' : 'Create New Layer'}
                </Dialog.Title>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-fg">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-accent focus:ring-ring sm:text-sm px-4 py-2 bg-bg-secondary text-fg"
                      placeholder="e.g., Frontend, Backend API"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-fg">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-accent focus:ring-ring sm:text-sm px-4 py-2 bg-bg-secondary text-fg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-fg">
                      Tech Stack (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={techStack}
                      onChange={(e) => setTechStack(e.target.value)}
                      className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-accent focus:ring-ring sm:text-sm px-4 py-2 bg-bg-secondary text-fg"
                      placeholder="React, TypeScript, Vite"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-fg">
                        Order Index <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        value={orderIndex}
                        onChange={(e) => setOrderIndex(Number(e.target.value))}
                        className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-accent focus:ring-ring sm:text-sm px-4 py-2 bg-bg-secondary text-fg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-fg">Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as LayerStatus)}
                        className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-accent focus:ring-ring sm:text-sm px-4 py-2 bg-bg-secondary text-fg"
                      >
                        <option value="active">Active</option>
                        <option value="deprecated">Deprecated</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-fg">Color</label>
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="mt-1 block w-full h-10 rounded-md border-border"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-fg">Icon (emoji)</label>
                      <input
                        type="text"
                        value={icon}
                        onChange={(e) => setIcon(e.target.value)}
                        className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-accent focus:ring-ring sm:text-sm px-4 py-2 bg-bg-secondary text-fg"
                        placeholder="🌐"
                      />
                    </div>
                  </div>

                  <div className="mt-5 sm:mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 inline-flex justify-center rounded-md border border-border bg-bg-secondary px-4 py-2 text-sm font-medium text-fg shadow-sm hover:bg-accent hover:text-accent-fg transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 inline-flex justify-center rounded-md border border-transparent bg-accent px-4 py-2 text-sm font-medium text-accent-fg shadow-sm hover:bg-accent-dark transition-all"
                    >
                      {layer ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}

// Component Modal Component
interface ComponentModalProps {
  open: boolean;
  onClose: () => void;
  component: Component | null;
  projectId: string;
  layers: Layer[];
  onSuccess: () => void;
}

function ComponentModal({ open, onClose, component, projectId, layers, onSuccess }: ComponentModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [filePatterns, setFilePatterns] = useState('');
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [color, setColor] = useState('#10B981');
  const [icon, setIcon] = useState('');
  const [status, setStatus] = useState<ComponentStatus>('active');

  useEffect(() => {
    if (component) {
      setName(component.name || '');
      setDescription(component.description || '');
      setFilePatterns((component.filePatterns || []).join('\n'));
      setSelectedLayerIds(component.layers?.map(cl => cl.layer.id) || []);
      setColor(component.color || '#10B981');
      setIcon(component.icon || '');
      setStatus(component.status || 'active');
    } else {
      setName('');
      setDescription('');
      setFilePatterns('');
      setSelectedLayerIds([]);
      setColor('#10B981');
      setIcon('');
      setStatus('active');
    }
  }, [component, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('accessToken');
    const data = {
      projectId,
      name,
      description,
      filePatterns: filePatterns.split('\n').map(p => p.trim()).filter(Boolean),
      layerIds: selectedLayerIds,
      color,
      icon,
      status,
    };

    // Only update if component has an ID (is an existing component)
    const isEditing = component && component.id;
    const url = isEditing ? `${API_BASE_URL}/components/${component.id}` : `${API_BASE_URL}/components`;
    const method = isEditing ? 'PATCH' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save component');
      }

      onSuccess();
    } catch (error: any) {
      alert(error.message);
    }
  };

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
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-card px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-fg mb-4">
                  {component ? 'Edit Component' : 'Create New Component'}
                </Dialog.Title>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-fg">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-accent focus:ring-ring sm:text-sm px-4 py-2 bg-bg-secondary text-fg"
                      placeholder="e.g., Authentication, Billing"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-fg">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-accent focus:ring-ring sm:text-sm px-4 py-2 bg-bg-secondary text-fg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-fg">
                      File Patterns (one per line)
                    </label>
                    <textarea
                      value={filePatterns}
                      onChange={(e) => setFilePatterns(e.target.value)}
                      rows={3}
                      className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-accent focus:ring-ring sm:text-sm font-mono text-xs px-4 py-2 bg-bg-secondary text-fg"
                      placeholder="**/auth/**&#10;**/*auth*"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-fg mb-2">
                      Layers (select all that apply)
                    </label>
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-border rounded-md p-2 bg-bg-secondary">
                      {layers.filter(l => l.status === 'active').map((layer) => (
                        <label key={layer.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedLayerIds.includes(layer.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLayerIds([...selectedLayerIds, layer.id]);
                              } else {
                                setSelectedLayerIds(selectedLayerIds.filter(id => id !== layer.id));
                              }
                            }}
                            className="h-4 w-4 text-accent focus:ring-ring border-border rounded"
                          />
                          <span className="ml-2 text-sm text-fg">
                            {layer.icon} {layer.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-fg">Color</label>
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="mt-1 block w-full h-10 rounded-md border-border"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-fg">Icon (emoji)</label>
                      <input
                        type="text"
                        value={icon}
                        onChange={(e) => setIcon(e.target.value)}
                        className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-accent focus:ring-ring sm:text-sm px-4 py-2 bg-bg-secondary text-fg"
                        placeholder="🔐"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-fg">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as ComponentStatus)}
                      className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-accent focus:ring-ring sm:text-sm px-4 py-2 bg-bg-secondary text-fg"
                    >
                      <option value="active">Active</option>
                      <option value="planning">Planning</option>
                      <option value="deprecated">Deprecated</option>
                    </select>
                  </div>

                  <div className="mt-5 sm:mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 inline-flex justify-center rounded-md border border-border bg-bg-secondary px-4 py-2 text-sm font-medium text-fg shadow-sm hover:bg-accent hover:text-accent-fg transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 inline-flex justify-center rounded-md border border-transparent bg-accent px-4 py-2 text-sm font-medium text-accent-fg shadow-sm hover:bg-accent-dark transition-all"
                    >
                      {component ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
