import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowActivationService, ActivationResponse } from '../services/workflow-activation.service';
import { useProject } from '../context/ProjectContext';

interface WorkflowActivationButtonProps {
  workflowId: string;
  workflowName: string;
  disabled?: boolean;
  onSuccess?: (result: ActivationResponse) => void;
  onError?: (error: any) => void;
}

export function WorkflowActivationButton({
  workflowId,
  workflowName,
  disabled,
  onSuccess,
  onError,
}: WorkflowActivationButtonProps) {
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id || '';
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [activationResult, setActivationResult] = useState<ActivationResponse | null>(null);

  const activateMutation = useMutation({
    mutationFn: (options: { forceOverwrite?: boolean }) =>
      workflowActivationService.activateInClaudeCode(projectId, workflowId, options),
    onSuccess: (data) => {
      setActivationResult(data);
      setShowModal(true);
      queryClient.invalidateQueries({ queryKey: ['active-workflow', projectId] });
      queryClient.invalidateQueries({ queryKey: ['workflows', projectId] });
      onSuccess?.(data);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || 'Activation failed';
      alert(`Failed to activate workflow: ${errorMessage}`);
      onError?.(error);
    },
  });

  const handleActivate = () => {
    if (!projectId) {
      alert('Please select a project first');
      return;
    }

    const confirmMessage = `Activate workflow "${workflowName}" in Claude Code?\n\nThis will generate agent files in your .claude/ directory.`;
    if (window.confirm(confirmMessage)) {
      activateMutation.mutate({});
    }
  };

  return (
    <>
      <button
        onClick={handleActivate}
        disabled={disabled || activateMutation.isPending}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {activateMutation.isPending ? 'Activating...' : 'Activate in Claude Code'}
      </button>

      {showModal && activationResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-green-600">✓ Workflow Activated!</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Workflow: {workflowName}</h3>
                <p className="text-sm text-gray-600">Version: {activationResult.version}</p>
              </div>

              {activationResult.conflicts && activationResult.conflicts.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Conflicts Detected</h4>
                  <p className="text-sm text-yellow-700 mb-2">
                    The following files were backed up:
                  </p>
                  <ul className="text-sm text-yellow-700 list-disc list-inside">
                    {activationResult.conflicts.map((file, i) => (
                      <li key={i} className="font-mono">
                        {file}
                      </li>
                    ))}
                  </ul>
                  {activationResult.backupLocation && (
                    <p className="text-sm text-yellow-700 mt-2">
                      Backup location: <span className="font-mono">{activationResult.backupLocation}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="bg-green-50 border border-green-200 rounded p-3">
                <h4 className="font-semibold text-green-800 mb-2">✓ Files Generated</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  {activationResult.filesGenerated.map((file, i) => (
                    <li key={i} className="font-mono flex items-center">
                      <span className="text-green-600 mr-2">✓</span>
                      {file}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <h4 className="font-semibold text-blue-800 mb-2">📘 Next Steps</h4>
                <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
                  <li>Open Claude Code in your project directory</li>
                  <li>The workflow agents are now available in .claude/agents/</li>
                  <li>Use the coordinator agent to orchestrate the workflow</li>
                  <li>Results will be tracked automatically</li>
                </ol>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
