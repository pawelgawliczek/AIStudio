import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { componentsService } from '../services/components.service';
import { Component, CreateComponentDto, ExecutionConfig } from '../types';
import { MarkdownEditor } from './MarkdownEditor';

interface CreateComponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: string;
  editingComponent?: Component | null;
}

const defaultConfig: ExecutionConfig = {
  modelId: 'claude-sonnet-4',
  temperature: 0.3,
  maxInputTokens: 50000,
  maxOutputTokens: 10000,
  timeout: 300,
  maxRetries: 2,
  costLimit: 5.0,
};

export function CreateComponentModal({ isOpen, onClose, onSuccess, projectId, editingComponent }: CreateComponentModalProps) {
  const [formData, setFormData] = useState<CreateComponentDto>({
    name: '',
    description: '',
    inputInstructions: '',
    operationInstructions: '',
    outputInstructions: '',
    config: defaultConfig,
    tools: [],
    onFailure: 'stop',
    tags: [],
    active: true,
    version: 'v1.0',
  });
  const [toolsInput, setToolsInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  useEffect(() => {
    if (editingComponent) {
      setFormData({
        name: editingComponent.name,
        description: editingComponent.description,
        inputInstructions: editingComponent.inputInstructions,
        operationInstructions: editingComponent.operationInstructions,
        outputInstructions: editingComponent.outputInstructions,
        config: editingComponent.config,
        tools: editingComponent.tools,
        onFailure: editingComponent.onFailure,
        tags: editingComponent.tags,
        active: editingComponent.active,
        version: editingComponent.version,
      });
      setToolsInput(editingComponent.tools.join(', '));
      setTagsInput(editingComponent.tags.join(', '));
    } else {
      // Reset form for create mode
      setFormData({
        name: '',
        description: '',
        inputInstructions: '',
        operationInstructions: '',
        outputInstructions: '',
        config: defaultConfig,
        tools: [],
        onFailure: 'stop',
        tags: [],
        active: true,
        version: 'v1.0',
      });
      setToolsInput('');
      setTagsInput('');
    }
  }, [editingComponent, isOpen]);

  const createMutation = useMutation({
    mutationFn: (data: CreateComponentDto) => componentsService.create(projectId, data),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CreateComponentDto) => componentsService.update(editingComponent!.id, data),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const tools = toolsInput.split(',').map(t => t.trim()).filter(Boolean);
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

    const data = {
      ...formData,
      tools,
      tags,
    };

    if (editingComponent) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-fg mb-4">
            {editingComponent ? 'Edit Component' : 'Create Component'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  Description
                </label>
                <MarkdownEditor
                  value={formData.description}
                  onChange={(val) => setFormData({ ...formData, description: val })}
                  placeholder="Brief description of the component..."
                  height={120}
                />
              </div>
            </div>

            {/* 3 Instruction Sets */}
            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="text-lg font-semibold text-fg">Instruction Sets</h3>

              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  Input Instructions *
                </label>
                <MarkdownEditor
                  value={formData.inputInstructions}
                  onChange={(val) => setFormData({ ...formData, inputInstructions: val })}
                  placeholder="How to receive and process input data... (Markdown supported)"
                  height={150}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  Operation Instructions *
                </label>
                <MarkdownEditor
                  value={formData.operationInstructions}
                  onChange={(val) => setFormData({ ...formData, operationInstructions: val })}
                  placeholder="What work to perform... (Markdown supported)"
                  height={180}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  Output Instructions *
                </label>
                <MarkdownEditor
                  value={formData.outputInstructions}
                  onChange={(val) => setFormData({ ...formData, outputInstructions: val })}
                  placeholder="How to format and return results... (Markdown supported)"
                  height={150}
                />
              </div>
            </div>

            {/* Config & Tools */}
            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="text-lg font-semibold text-fg">Configuration</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">
                    Model ID
                  </label>
                  <input
                    type="text"
                    value={formData.config.modelId}
                    onChange={(e) => setFormData({ ...formData, config: { ...formData.config, modelId: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-fg mb-1">
                    Temperature
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={formData.config.temperature}
                    onChange={(e) => setFormData({ ...formData, config: { ...formData.config, temperature: parseFloat(e.target.value) } })}
                    className="w-full px-3 py-2 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  MCP Tools (comma-separated)
                </label>
                <input
                  type="text"
                  value={toolsInput}
                  onChange={(e) => setToolsInput(e.target.value)}
                  placeholder="create_story, update_story, get_story"
                  className="w-full px-3 py-2 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">
                    On Failure
                  </label>
                  <select
                    value={formData.onFailure}
                    onChange={(e) => setFormData({ ...formData, onFailure: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg"
                  >
                    <option value="stop">Stop</option>
                    <option value="skip">Skip</option>
                    <option value="retry">Retry</option>
                    <option value="pause">Pause</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-fg mb-1">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="requirements, analysis"
                    className="w-full px-3 py-2 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-fg border border-border rounded-lg hover:bg-accent hover:text-accent-fg transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 bg-accent text-accent-fg rounded-lg hover:bg-accent-dark disabled:opacity-50 transition-all"
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (editingComponent ? 'Update' : 'Create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
