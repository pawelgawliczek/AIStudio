import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowActivationService } from '../services/workflow-activation.service';
import { useProject } from '../context/ProjectContext';
import { useState } from 'react';

export function ActiveWorkflowBanner() {
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id || '';
  const queryClient = useQueryClient();
  const [showSyncResult, setShowSyncResult] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const { data: activeWorkflow, isLoading } = useQuery({
    queryKey: ['active-workflow', projectId],
    queryFn: () => workflowActivationService.getActiveWorkflow(projectId),
    enabled: !!projectId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const syncMutation = useMutation({
    mutationFn: () => workflowActivationService.syncClaudeCode(projectId),
    onSuccess: (data) => {
      if (data.updated) {
        setSyncMessage(
          `✓ Synced to ${data.newVersion}! ${data.filesUpdated.length} files updated.`,
        );
      } else {
        setSyncMessage('✓ Already up to date!');
      }
      setShowSyncResult(true);
      setTimeout(() => setShowSyncResult(false), 5000);
      queryClient.invalidateQueries({ queryKey: ['active-workflow', projectId] });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Sync failed';
      alert(`Failed to sync workflow: ${errorMessage}`);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => workflowActivationService.deactivateFromClaudeCode(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-workflow', projectId] });
      queryClient.invalidateQueries({ queryKey: ['workflows', projectId] });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Deactivation failed';
      alert(`Failed to deactivate workflow: ${errorMessage}`);
    },
  });

  const handleSync = () => {
    if (window.confirm('Sync workflow to the latest version?')) {
      syncMutation.mutate();
    }
  };

  const handleDeactivate = () => {
    if (
      window.confirm(
        'Deactivate workflow and remove generated files?\n\nThis will delete the agent files from your .claude/ directory.',
      )
    ) {
      deactivateMutation.mutate();
    }
  };

  if (isLoading || !activeWorkflow?.workflowId) {
    return null;
  }

  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-500 mt-0.5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-blue-800">
              Active Workflow: {activeWorkflow.workflowName}
            </h3>
            <div className="mt-1 text-sm text-blue-700">
              <p>
                Version {activeWorkflow.version} • Activated{' '}
                {activeWorkflow.activatedAt &&
                  new Date(activeWorkflow.activatedAt).toLocaleString()}
              </p>
              {activeWorkflow.filesGenerated && activeWorkflow.filesGenerated.length > 0 && (
                <p className="mt-1 text-xs">
                  {activeWorkflow.filesGenerated.length} files generated in .claude/
                </p>
              )}
            </div>
            {showSyncResult && (
              <div className="mt-2 text-sm font-medium text-green-700">{syncMessage}</div>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 flex space-x-2">
          <button
            onClick={handleSync}
            disabled={syncMutation.isPending}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {syncMutation.isPending ? 'Syncing...' : 'Sync'}
          </button>
          <button
            onClick={handleDeactivate}
            disabled={deactivateMutation.isPending}
            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
          >
            {deactivateMutation.isPending ? 'Deactivating...' : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  );
}
