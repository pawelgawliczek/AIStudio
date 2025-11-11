import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition, Tab } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Epic, StoryType, Layer, Component } from '../types';
import { API_BASE_URL } from '../config';

interface CreateStoryModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    type: StoryType;
    epicId?: string;
    technicalComplexity?: number;
    businessImpact?: number;
    businessComplexity?: number;
    layerIds?: string[];
    componentIds?: string[];
  }) => void;
  epics: Epic[];
  projectId: string;
  isLoading?: boolean;
  initialData?: {
    title: string;
    description: string;
    type: StoryType;
    epicId?: string;
    technicalComplexity?: number;
    businessImpact?: number;
    businessComplexity?: number;
    layerIds?: string[];
    componentIds?: string[];
  };
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export function CreateStoryModal({
  open,
  onClose,
  onSubmit,
  epics,
  projectId,
  isLoading = false,
  initialData,
}: CreateStoryModalProps) {
  const isEditing = !!initialData;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<StoryType>(StoryType.FEATURE);
  const [epicId, setEpicId] = useState('');
  const [technicalComplexity, setTechnicalComplexity] = useState<number>(3);
  const [businessImpact, setBusinessImpact] = useState<number>(3);
  const [businessComplexity, setBusinessComplexity] = useState<number>(3);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);

  const [layers, setLayers] = useState<Layer[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [loadingLayers, setLoadingLayers] = useState(false);
  const [loadingComponents, setLoadingComponents] = useState(false);

  // Populate form with initial data when editing
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description);
      setType(initialData.type);
      setEpicId(initialData.epicId || '');
      // Clamp complexity and impact values to valid range (1-5)
      setTechnicalComplexity(Math.min(Math.max(initialData.technicalComplexity || 3, 1), 5));
      setBusinessImpact(Math.min(Math.max(initialData.businessImpact || 3, 1), 5));
      setBusinessComplexity(Math.min(Math.max(initialData.businessComplexity || 3, 1), 5));
      setSelectedLayerIds(initialData.layerIds || []);
      setSelectedComponentIds(initialData.componentIds || []);
    } else {
      // Reset form when creating new
      setTitle('');
      setDescription('');
      setType(StoryType.FEATURE);
      setEpicId('');
      setTechnicalComplexity(3);
      setBusinessImpact(3);
      setBusinessComplexity(3);
      setSelectedLayerIds([]);
      setSelectedComponentIds([]);
    }
  }, [initialData, open]);

  // Fetch layers and components when modal opens
  useEffect(() => {
    if (open && projectId) {
      fetchLayers();
      fetchComponents();
    }
  }, [open, projectId]);

  const fetchLayers = async () => {
    setLoadingLayers(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/layers?projectId=${projectId}&status=active`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setLayers(data.sort((a: Layer, b: Layer) => a.orderIndex - b.orderIndex));
      }
    } catch (error) {
      console.error('Failed to fetch layers:', error);
    } finally {
      setLoadingLayers(false);
    }
  };

  const fetchComponents = async () => {
    setLoadingComponents(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/components?projectId=${projectId}&status=active`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setComponents(data.sort((a: Component, b: Component) => a.name.localeCompare(b.name)));
      }
    } catch (error) {
      console.error('Failed to fetch components:', error);
    } finally {
      setLoadingComponents(false);
    }
  };

  const toggleLayer = (layerId: string) => {
    setSelectedLayerIds((prev) =>
      prev.includes(layerId)
        ? prev.filter((id) => id !== layerId)
        : [...prev, layerId]
    );
  };

  const toggleComponent = (componentId: string) => {
    setSelectedComponentIds((prev) =>
      prev.includes(componentId)
        ? prev.filter((id) => id !== componentId)
        : [...prev, componentId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description,
      type,
      epicId: epicId || undefined,
      technicalComplexity,
      businessImpact,
      businessComplexity,
      layerIds: selectedLayerIds.length > 0 ? selectedLayerIds : undefined,
      componentIds: selectedComponentIds.length > 0 ? selectedComponentIds : undefined,
    });
    // Form will be reset via useEffect when modal closes
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-card px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl sm:p-6">
                <div className="absolute right-0 top-0 pr-4 pt-4">
                  <button
                    type="button"
                    className="rounded-md bg-card text-muted hover:text-fg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  <div className="w-full mt-3 text-center sm:mt-0 sm:text-left">
                    <Dialog.Title
                      as="h3"
                      className="text-xl font-semibold leading-6 text-fg mb-6"
                    >
                      {isEditing ? 'Edit Story' : 'Create New Story'}
                    </Dialog.Title>

                    <form onSubmit={handleSubmit} className="space-y-6">
                      <Tab.Group>
                        <Tab.List className="flex space-x-1 rounded-xl bg-accent/10 p-1">
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
                            Details
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
                            Organization
                          </Tab>
                        </Tab.List>
                        <Tab.Panels className="mt-6">
                          {/* Details Tab */}
                          <Tab.Panel className="space-y-6">
                            {/* Title */}
                            <div>
                              <label
                                htmlFor="title"
                                className="block text-sm font-medium text-fg mb-2"
                              >
                                Title <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                id="title"
                                required
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="block w-full rounded-md border-border shadow-sm focus:border-accent focus:ring-ring sm:text-sm py-2.5 px-4 bg-bg-secondary text-fg"
                                placeholder="Enter story title..."
                              />
                            </div>

                            {/* Description */}
                            <div>
                              <label
                                htmlFor="description"
                                className="block text-sm font-medium text-fg mb-2"
                              >
                                Description
                              </label>
                              <textarea
                                id="description"
                                rows={4}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="block w-full rounded-md border-border shadow-sm focus:border-accent focus:ring-ring sm:text-sm px-4 py-2 bg-bg-secondary text-fg"
                                placeholder="Describe the story..."
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Type */}
                              <div>
                                <label
                                  htmlFor="type"
                                  className="block text-sm font-medium text-fg mb-2"
                                >
                                  Type <span className="text-red-500">*</span>
                                </label>
                                <select
                                  id="type"
                                  required
                                  value={type}
                                  onChange={(e) => setType(e.target.value as StoryType)}
                                  className="block w-full rounded-md border-border shadow-sm focus:border-accent focus:ring-ring sm:text-sm py-2.5 px-4 bg-bg-secondary text-fg"
                                >
                                  <option value="feature">Feature</option>
                                  <option value="bug">Bug</option>
                                  <option value="tech_debt">Tech Debt</option>
                                  <option value="spike">Spike</option>
                                </select>
                              </div>

                              {/* Epic */}
                              <div>
                                <label
                                  htmlFor="epic"
                                  className="block text-sm font-medium text-fg mb-2"
                                >
                                  Epic
                                </label>
                                <select
                                  id="epic"
                                  value={epicId}
                                  onChange={(e) => setEpicId(e.target.value)}
                                  className="block w-full rounded-md border-border shadow-sm focus:border-accent focus:ring-ring sm:text-sm py-2.5 px-4 bg-bg-secondary text-fg"
                                >
                                  <option value="">No Epic</option>
                                  {epics.map((epic) => (
                                    <option key={epic.id} value={epic.id}>
                                      {epic.key} - {epic.title}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Technical Complexity */}
                              <div>
                                <label
                                  htmlFor="complexity"
                                  className="block text-sm font-medium text-fg mb-2"
                                >
                                  Technical Complexity
                                </label>
                                <select
                                  id="complexity"
                                  value={technicalComplexity}
                                  onChange={(e) => setTechnicalComplexity(Number(e.target.value))}
                                  className="block w-full rounded-md border-border shadow-sm focus:border-accent focus:ring-ring sm:text-sm py-2.5 px-4 bg-bg-secondary text-fg"
                                >
                                  <option value="1">1 - Simple</option>
                                  <option value="2">2 - Easy</option>
                                  <option value="3">3 - Medium</option>
                                  <option value="4">4 - Complex</option>
                                  <option value="5">5 - Very Complex</option>
                                </select>
                              </div>

                              {/* Business Impact */}
                              <div>
                                <label
                                  htmlFor="impact"
                                  className="block text-sm font-medium text-fg mb-2"
                                >
                                  Business Impact
                                </label>
                                <select
                                  id="impact"
                                  value={businessImpact}
                                  onChange={(e) => setBusinessImpact(Number(e.target.value))}
                                  className="block w-full rounded-md border-border shadow-sm focus:border-accent focus:ring-ring sm:text-sm py-2.5 px-4 bg-bg-secondary text-fg"
                                >
                                  <option value="1">1 - Low</option>
                                  <option value="2">2 - Minor</option>
                                  <option value="3">3 - Medium</option>
                                  <option value="4">4 - High</option>
                                  <option value="5">5 - Critical</option>
                                </select>
                              </div>
                            </div>
                          </Tab.Panel>

                          {/* Organization Tab */}
                          <Tab.Panel className="space-y-6">
                            {/* Layers Selection */}
                            <div>
                              <label className="block text-sm font-medium text-fg mb-3">
                                Layers (Technical Stack)
                              </label>
                              <p className="text-xs text-muted mb-3">
                                Select the technical layers this story spans
                              </p>
                              {loadingLayers ? (
                                <div className="text-sm text-muted">Loading layers...</div>
                              ) : layers.length === 0 ? (
                                <div className="text-sm text-muted">
                                  No active layers found. Please configure layers in project settings.
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 gap-3">
                                  {layers.map((layer) => (
                                    <button
                                      key={layer.id}
                                      type="button"
                                      onClick={() => toggleLayer(layer.id)}
                                      className={classNames(
                                        'flex items-center justify-between p-3 rounded-lg border-2 transition-colors',
                                        selectedLayerIds.includes(layer.id)
                                          ? 'border-accent bg-accent/10'
                                          : 'border-border hover:border-accent/50'
                                      )}
                                    >
                                      <div className="flex items-center space-x-2">
                                        {layer.icon && <span className="text-lg">{layer.icon}</span>}
                                        <div className="text-left">
                                          <div className="text-sm font-medium text-fg">
                                            {layer.name}
                                          </div>
                                          {layer.techStack && layer.techStack.length > 0 && (
                                            <div className="text-xs text-muted">
                                              {layer.techStack.slice(0, 2).join(', ')}
                                              {layer.techStack.length > 2 && '...'}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      {selectedLayerIds.includes(layer.id) && (
                                        <span className="text-accent">✓</span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {selectedLayerIds.length > 0 && (
                                <div className="mt-2 text-xs text-muted">
                                  {selectedLayerIds.length} layer(s) selected
                                </div>
                              )}
                            </div>

                            {/* Components Selection */}
                            <div>
                              <label className="block text-sm font-medium text-fg mb-3">
                                Components (Business Domains)
                              </label>
                              <p className="text-xs text-muted mb-3">
                                Select the business components this story affects
                              </p>
                              {loadingComponents ? (
                                <div className="text-sm text-muted">Loading components...</div>
                              ) : components.length === 0 ? (
                                <div className="text-sm text-muted">
                                  No active components found. Please configure components in project settings.
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 gap-3">
                                  {components.map((component) => (
                                    <button
                                      key={component.id}
                                      type="button"
                                      onClick={() => toggleComponent(component.id)}
                                      className={classNames(
                                        'flex items-center justify-between p-3 rounded-lg border-2 transition-colors',
                                        selectedComponentIds.includes(component.id)
                                          ? 'border-green-500 bg-green-500/10'
                                          : 'border-border hover:border-green-500/50'
                                      )}
                                    >
                                      <div className="flex items-center space-x-2">
                                        {component.icon && <span className="text-lg">{component.icon}</span>}
                                        <div className="text-left">
                                          <div className="text-sm font-medium text-fg">
                                            {component.name}
                                          </div>
                                          {component.description && (
                                            <div className="text-xs text-muted truncate max-w-[150px]">
                                              {component.description}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      {selectedComponentIds.includes(component.id) && (
                                        <span className="text-green-500">✓</span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {selectedComponentIds.length > 0 && (
                                <div className="mt-2 text-xs text-muted">
                                  {selectedComponentIds.length} component(s) selected
                                </div>
                              )}
                            </div>
                          </Tab.Panel>
                        </Tab.Panels>
                      </Tab.Group>

                      {/* Action Buttons */}
                      <div className="mt-6 flex justify-end gap-3">
                        <button
                          type="button"
                          className="inline-flex justify-center rounded-md border border-border bg-bg-secondary px-4 py-2 text-sm font-medium text-fg shadow-sm hover:bg-accent hover:text-accent-fg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all"
                          onClick={onClose}
                          disabled={isLoading}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="inline-flex justify-center rounded-md border border-transparent bg-accent px-4 py-2 text-sm font-medium text-accent-fg shadow-sm hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 transition-all"
                          disabled={isLoading}
                        >
                          {isLoading ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Story' : 'Create Story')}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
