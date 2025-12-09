/**
 * StartWorkflowModal Component
 * ST-195: Modal for selecting and starting a workflow/team for a story
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowService } from '../../services/workflow.service';

interface StartWorkflowModalProps {
  open: boolean;
  onClose: () => void;
  storyId: string;
  projectId: string;
  onStart?: (runId: string) => void;
}

export const StartWorkflowModal: React.FC<StartWorkflowModalProps> = ({
  open,
  onClose,
  storyId,
  projectId,
  onStart,
}) => {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const queryClient = useQueryClient();

  // Fetch available teams/workflows
  const { data: workflows, isLoading } = useQuery({
    queryKey: ['workflows', projectId],
    queryFn: () => workflowService.listTeams(projectId),
    enabled: open && !!projectId,
  });

  // Start workflow mutation
  const startMutation = useMutation({
    mutationFn: () => workflowService.executeStoryWithTeam(storyId, selectedWorkflowId),
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['workflow-run'] });
      queryClient.invalidateQueries({ queryKey: ['story', storyId] });

      onStart?.(data.runId);
      onClose();
    },
  });

  const handleStart = () => {
    if (!selectedWorkflowId) return;
    startMutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      data-testid="start-workflow-modal"
    >
      <DialogTitle>START WORKFLOW</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            ℹ️ Starting workflow for story: {storyId.split('-')[0]}
          </Typography>
        </Box>

        {isLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <FormControl component="fieldset" fullWidth>
            <FormLabel component="legend">Select Team/Workflow</FormLabel>
            <RadioGroup
              value={selectedWorkflowId}
              onChange={(e) => setSelectedWorkflowId(e.target.value)}
            >
              {workflows?.map((workflow) => (
                <FormControlLabel
                  key={workflow.id}
                  value={workflow.id}
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {workflow.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {workflow.stateCount || 0} states
                        {workflow.description && ` • ${workflow.description}`}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </RadioGroup>
          </FormControl>
        )}

        {startMutation.isError && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
            <Typography variant="body2" color="error.dark">
              Failed to start workflow: {(startMutation.error as Error).message}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={startMutation.isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleStart}
          variant="contained"
          disabled={!selectedWorkflowId || startMutation.isPending}
          startIcon={startMutation.isPending ? <CircularProgress size={20} /> : <span>▶</span>}
          data-testid="start-workflow-btn"
        >
          Start Workflow
        </Button>
      </DialogActions>
    </Dialog>
  );
};
