import { useMutation, useQueryClient } from '@tanstack/react-query';
import { coordinatorsService } from '../services/coordinators.service';

export interface CoordinatorActionsReturn {
  handleDelete: (id: string) => Promise<void>;
  handleToggleActive: (id: string, active: boolean) => Promise<void>;
  isDeleting: boolean;
  isTogglingActive: boolean;
}

export function useCoordinatorActions(projectId: string): CoordinatorActionsReturn {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => coordinatorsService.delete(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coordinators'] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active
        ? coordinatorsService.deactivate(projectId, id)
        : coordinatorsService.activate(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coordinators'] });
    },
  });

  const handleDelete = async (id: string) => {
    if (
      confirm(
        'Are you sure you want to delete this coordinator? This action cannot be undone.'
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
