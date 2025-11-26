import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tab } from '@headlessui/react';
import { ArrowLeftIcon, TrashIcon, PencilIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

import { coordinatorsService } from '../services/coordinators.service';
import { versioningService } from '../services/versioning.service';
import { analyticsService } from '../services/analytics.service';
import { useProject } from '../context/ProjectContext';
import { CoordinatorAgent, UpdateCoordinatorDto } from '../types';

import { VersionBadge } from '../components/VersionBadge';
import { VersionBumpModal } from '../components/VersionBumpModal';
import { VersionComparisonModal } from '../components/VersionComparisonModal';
import {
  VersionHistoryTimeline,
  InstructionSetsDisplay,
  WorkflowsUsingTable,
  ConfigurationDisplay,
} from '../components/shared';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface EditFormData {
  name: string;
  description: string;
  domain: string;
  coordinatorInstructions: string;
  decisionStrategy: 'sequential' | 'parallel' | 'conditional' | 'adaptive';
  config: {
    modelId: string;
    temperature: number;
    maxInputTokens: number;
    maxOutputTokens: number;
    timeout: number;
    maxRetries: number;
    costLimit: number;
  };
  tools: string[];
}

export function CoordinatorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id || '';

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<EditFormData | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Version modal state
  const [showVersionBumpModal, setShowVersionBumpModal] = useState(false);

  // Version comparison state
  const [selectedVersion1, setSelectedVersion1] = useState<string | null>(null);
  const [selectedVersion2, setSelectedVersion2] = useState<string | null>(null);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);

  // Workflow filter state
  const [workflowVersionFilter, setWorkflowVersionFilter] = useState<string>('all');

  // Fetch coordinator
  const {
    data: coordinator,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['coordinator', projectId, id],
    queryFn: () => coordinatorsService.getById(projectId, id!, true),
    enabled: !!projectId && !!id,
  });

  // Fetch version history
  const { data: versions = [], isLoading: versionsLoading } = useQuery({
    queryKey: ['coordinatorVersions', id],
    queryFn: () => versioningService.getCoordinatorVersionHistory(id!),
    enabled: !!id,
  });

  // Fetch analytics for workflows
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['coordinatorAnalytics', id],
    queryFn: () => analyticsService.getCoordinatorAnalytics(id!),
    enabled: !!id,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => coordinatorsService.delete(projectId, id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coordinators'] });
      navigate('/coordinators');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateCoordinatorDto) => coordinatorsService.update(projectId, id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coordinator', projectId, id] });
      queryClient.invalidateQueries({ queryKey: ['coordinatorVersions', id] });
      setIsEditing(false);
      setFormData(null);
    },
  });

  // Initialize form data when entering edit mode
  const handleStartEdit = useCallback(() => {
    if (!coordinator) return;

    setFormData({
      name: coordinator.name,
      description: coordinator.description || '',
      domain: coordinator.domain,
      coordinatorInstructions: coordinator.coordinatorInstructions,
      decisionStrategy: coordinator.decisionStrategy,
      config: { ...coordinator.config },
      tools: [...coordinator.tools],
    });
    setErrors({});
    setIsEditing(true);
  }, [coordinator]);

  // Cancel edit mode
  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormData(null);
    setErrors({});
  };

  // Handle form field changes
  const handleFieldChange = (field: string, value: any) => {
    if (!formData) return;

    if (field.startsWith('config.')) {
      const configField = field.replace('config.', '');
      setFormData({
        ...formData,
        config: {
          ...formData.config,
          [configField]: value,
        },
      });
    } else {
      setFormData({
        ...formData,
        [field]: value,
      });
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData) return false;

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.coordinatorInstructions.trim()) {
      newErrors.coordinatorInstructions = 'Coordinator instructions are required';
    }
    if (!formData.domain.trim()) {
      newErrors.domain = 'Domain is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save - opens version bump modal
  const handleSave = () => {
    if (validateForm()) {
      setShowVersionBumpModal(true);
    }
  };

  // Handle version creation success
  const handleVersionCreated = async (newVersion: string) => {
    // The version has been created, now update the coordinator with new data
    if (formData) {
      await updateMutation.mutateAsync(formData);
    }
    setShowVersionBumpModal(false);
  };

  // Handle delete
  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${coordinator?.name}"?`)) {
      deleteMutation.mutate();
    }
  };

  // Handle version selection for comparison
  const handleVersionSelect = (versionId: string, checked: boolean) => {
    if (checked) {
      if (!selectedVersion1) {
        setSelectedVersion1(versionId);
      } else if (!selectedVersion2 && selectedVersion1 !== versionId) {
        setSelectedVersion2(versionId);
      }
    } else {
      if (selectedVersion1 === versionId) {
        setSelectedVersion1(selectedVersion2);
        setSelectedVersion2(null);
      } else if (selectedVersion2 === versionId) {
        setSelectedVersion2(null);
      }
    }
  };

  // Handle navigation warning for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isEditing && formData) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditing, formData]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  // Error state
  if (error || !coordinator) {
    return (
      <div className="text-center py-12">
        <p className="text-fg text-lg">Coordinator not found</p>
        <Link to="/coordinators" className="text-accent hover:underline mt-2 inline-block">
          ← Back to Coordinators
        </Link>
      </div>
    );
  }

  // Get display data (either from formData if editing, or from coordinator)
  const displayData = isEditing && formData ? formData : coordinator;

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Back link */}
      <Link
        to="/coordinators"
        className="inline-flex items-center gap-2 text-fg hover:text-accent mb-6 transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to Coordinators
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-fg">{displayData.name}</h1>
            <VersionBadge version={coordinator.version} status="current" size="lg" />
          </div>
          {displayData.description && (
            <p className="mt-2 text-fg max-w-3xl">{displayData.description}</p>
          )}
          <div className="mt-2 flex items-center gap-4 text-sm text-fg">
            <span>Domain: <strong>{displayData.domain}</strong></span>
            <span>Strategy: <strong className="capitalize">{displayData.decisionStrategy}</strong></span>
          </div>
        </div>

        {/* Usage stats */}
        {coordinator.usageStats && (
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-fg">{coordinator.usageStats.totalRuns}</div>
              <div className="text-fg">Total Runs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-fg">
                {coordinator.usageStats.successRate.toFixed(1)}%
              </div>
              <div className="text-fg">Success Rate</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tab.Group>
        <Tab.List className="flex space-x-1 rounded-xl bg-bg-secondary p-1 mb-6">
          <Tab
            disabled={isEditing}
            className={({ selected }) =>
              classNames(
                'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-bg ring-accent',
                selected
                  ? 'bg-accent text-white shadow'
                  : 'text-fg hover:bg-bg-secondary/[0.6] hover:text-accent',
                isEditing && !selected ? 'opacity-50 cursor-not-allowed' : ''
              )
            }
          >
            Overview
          </Tab>
          <Tab
            disabled={isEditing}
            className={({ selected }) =>
              classNames(
                'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-bg ring-accent',
                selected
                  ? 'bg-accent text-white shadow'
                  : 'text-fg hover:bg-bg-secondary/[0.6] hover:text-accent',
                isEditing && !selected ? 'opacity-50 cursor-not-allowed' : ''
              )
            }
          >
            Version History
          </Tab>
          <Tab
            disabled={isEditing}
            className={({ selected }) =>
              classNames(
                'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-bg ring-accent',
                selected
                  ? 'bg-accent text-white shadow'
                  : 'text-fg hover:bg-bg-secondary/[0.6] hover:text-accent',
                isEditing && !selected ? 'opacity-50 cursor-not-allowed' : ''
              )
            }
          >
            Workflows
          </Tab>
        </Tab.List>

        <Tab.Panels>
          {/* Overview Tab */}
          <Tab.Panel className="rounded-xl bg-bg p-4 focus:outline-none">
            <div className="space-y-6">
              <InstructionSetsDisplay
                coordinatorInstructions={displayData.coordinatorInstructions}
                isEditing={isEditing}
                onChange={handleFieldChange}
                errors={errors}
              />

              <ConfigurationDisplay
                config={displayData.config}
                tools={displayData.tools}
                decisionStrategy={displayData.decisionStrategy}
                domain={displayData.domain}
                isEditing={isEditing}
                onChange={handleFieldChange}
                errors={errors}
              />
            </div>
          </Tab.Panel>

          {/* Version History Tab */}
          <Tab.Panel className="rounded-xl bg-bg p-4 focus:outline-none">
            <VersionHistoryTimeline
              versions={versions}
              entityType="coordinator"
              selectedVersions={[selectedVersion1, selectedVersion2]}
              onVersionSelect={handleVersionSelect}
              onCompare={() => setIsComparisonModalOpen(true)}
              isLoading={versionsLoading}
            />
          </Tab.Panel>

          {/* Workflows Tab */}
          <Tab.Panel className="rounded-xl bg-bg p-4 focus:outline-none">
            <WorkflowsUsingTable
              workflows={analytics?.workflowsUsing || []}
              allVersions={versions.map((v) => v.version)}
              versionFilter={workflowVersionFilter}
              onVersionFilterChange={setWorkflowVersionFilter}
              isLoading={analyticsLoading}
            />
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>

      {/* Action buttons */}
      <div className="mt-6 pt-4 border-t border-border flex items-center justify-end gap-3">
        {isEditing ? (
          <>
            <button
              onClick={handleCancelEdit}
              className="inline-flex items-center gap-2 px-4 py-2 text-fg hover:text-accent transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-50"
            >
              <CheckIcon className="w-5 h-5" />
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
            >
              <TrashIcon className="w-5 h-5" />
              Delete
            </button>
            <button
              onClick={handleStartEdit}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors"
            >
              <PencilIcon className="w-5 h-5" />
              Edit
            </button>
          </>
        )}
      </div>

      {/* Version Bump Modal */}
      {coordinator && (
        <VersionBumpModal
          isOpen={showVersionBumpModal}
          onClose={() => setShowVersionBumpModal(false)}
          entityType="coordinator"
          entityId={coordinator.id}
          entityName={coordinator.name}
          currentVersion={coordinator.version}
          onSuccess={handleVersionCreated}
        />
      )}

      {/* Version Comparison Modal */}
      {selectedVersion1 && selectedVersion2 && (
        <VersionComparisonModal
          isOpen={isComparisonModalOpen}
          onClose={() => setIsComparisonModalOpen(false)}
          entityType="coordinator"
          versionId1={selectedVersion1}
          versionId2={selectedVersion2}
          version1Label={versions.find((v) => v.id === selectedVersion1)?.version}
          version2Label={versions.find((v) => v.id === selectedVersion2)?.version}
        />
      )}
    </div>
  );
}
