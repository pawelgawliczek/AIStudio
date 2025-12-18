import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { workflowActivationService, ActivationResponse } from '../services/workflow-activation.service';

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
        className="px-4 py-2 bg-accent text-accent-fg rounded hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {activateMutation.isPending ? 'Activating...' : 'Activate in Claude Code'}
      </button>

      {showModal && activationResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-accent">✓ Workflow Activated!</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted hover:text-fg text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2 text-fg">Workflow: {workflowName}</h3>
                <p className="text-sm text-muted">Version: {activationResult.version}</p>
              </div>

              {activationResult.conflicts && activationResult.conflicts.length > 0 && (
                <div className="bg-yellow-100/50 border border-yellow-300 rounded p-3">
                  <h4 className="font-semibold text-fg mb-2">⚠️ Conflicts Detected</h4>
                  <p className="text-sm text-muted mb-2">
                    The following files were backed up:
                  </p>
                  <ul className="text-sm text-muted list-disc list-inside">
                    {activationResult.conflicts.map((file, i) => (
                      <li key={i} className="font-mono">
                        {file}
                      </li>
                    ))}
                  </ul>
                  {activationResult.backupLocation && (
                    <p className="text-sm text-muted mt-2">
                      Backup location: <span className="font-mono">{activationResult.backupLocation}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="bg-accent/10 border border-accent rounded p-3">
                <h4 className="font-semibold text-fg mb-2">✓ Files Generated</h4>
                <ul className="text-sm text-muted space-y-1">
                  {activationResult.filesGenerated.map((file, i) => (
                    <li key={i} className="font-mono flex items-center">
                      <span className="text-accent mr-2">✓</span>
                      {file}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-accent/10 border border-accent rounded p-3">
                <h4 className="font-semibold text-fg mb-2">📘 Next Steps</h4>
                <ol className="text-sm text-muted list-decimal list-inside space-y-1">
                  <li>Open Claude Code in your project directory</li>
                  <li>The workflow agents are now available in .claude/agents/</li>
                  <li>Use the coordinator agent to orchestrate the workflow</li>
                  <li>Results will be tracked automatically</li>
                </ol>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="w-full px-4 py-2 bg-accent text-accent-fg rounded hover:bg-accent-dark transition-all"
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
