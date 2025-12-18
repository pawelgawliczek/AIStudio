import { useMutation, useQueryClient } from '@tanstack/react-query';
import { componentsService } from '../services/components.service';
import { WorkflowComponent } from '../types';

export interface ComponentActionsReturn {
  handleDelete: (id: string) => Promise<void>;
  handleToggleActive: (component: WorkflowComponent) => Promise<void>;
  handleEdit: (component: WorkflowComponent, callback: (component: WorkflowComponent) => void) => void;
  isDeleting: boolean;
  isTogglingActive: boolean;
}

export function useComponentActions(
  projectId: string,
  onDeleteSuccess?: () => void
): ComponentActionsReturn {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => componentsService.delete(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
      onDeleteSuccess?.();
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active
        ? componentsService.deactivate(projectId, id)
        : componentsService.activate(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
    },
  });

  const handleDelete = async (id: string) => {
    if (
      confirm(
        'Are you sure you want to delete this component? This action cannot be undone.'
      )
    ) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleToggleActive = async (component: WorkflowComponent) => {
    await toggleActiveMutation.mutateAsync({
      id: component.id,
      active: component.active,
    });
  };

  const handleEdit = (component: WorkflowComponent, callback: (component: WorkflowComponent) => void) => {
    callback(component);
  };

  return {
    handleDelete,
    handleToggleActive,
    handleEdit,
    isDeleting: deleteMutation.isPending,
    isTogglingActive: toggleActiveMutation.isPending,
  };
}
