import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowsService } from '../services/workflows.service';

export interface WorkflowActionsReturn {
  handleDelete: (id: string) => Promise<void>;
  handleToggleActive: (id: string, active: boolean) => Promise<void>;
  isDeleting: boolean;
  isTogglingActive: boolean;
}

export function useWorkflowActions(projectId: string): WorkflowActionsReturn {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workflowsService.delete(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active
        ? workflowsService.deactivate(projectId, id)
        : workflowsService.activate(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const handleDelete = async (id: string) => {
    if (
      confirm(
        'Are you sure you want to delete this workflow? This action cannot be undone.'
      )
    ) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    await toggleActiveMutation.mutateAsync({ id, active });
  };

  return {
    handleDelete,
    handleToggleActive,
    isDeleting: deleteMutation.isPending,
    isTogglingActive: toggleActiveMutation.isPending,
  };
}
