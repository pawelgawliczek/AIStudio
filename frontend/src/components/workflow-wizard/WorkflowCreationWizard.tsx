import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';
import { WorkflowWizardProvider, useWorkflowWizard } from '../../contexts/WorkflowWizardContext';
import { WorkflowShellForm } from './WorkflowShellForm';
import { ComponentVersionSelector } from './ComponentVersionSelector';
import { CoordinatorSelector } from './CoordinatorSelector';
import { apiClient } from '../../services/api.client';

const STEPS = ['Workflow Information', 'Select Components', 'Choose Coordinator'];

interface WorkflowCreationWizardProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projects: Array<{ id: string; name: string }>;
  onSuccess: () => void;
}

const WizardContent: React.FC<Omit<WorkflowCreationWizardProps, 'projectId'>> = ({
  open,
  onClose,
  projects,
  onSuccess,
}) => {
  const { state, currentStep, nextStep, previousStep, canProceedToStep, resetWizard } = useWorkflowWizard();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    if (currentStep < 3) {
      nextStep();
    }
  };

  const handleBack = () => {
    previousStep();
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // Create coordinator if in "new" mode
      let coordinatorId = state.coordinatorId;

      if (state.coordinatorMode === 'new' && state.newCoordinator) {
        const coordinatorData = {
          name: state.newCoordinator.name,
          description: `Coordinator for ${state.name}`,
          inputInstructions: 'Receive workflow context and story information',
          operationInstructions: state.newCoordinator.instructions,
          outputInstructions: 'Produce workflow execution results',
          config: {
            modelId: state.newCoordinator.modelId,
            temperature: state.newCoordinator.temperature,
            decisionStrategy: state.newCoordinator.decisionStrategy,
            maxRetries: state.newCoordinator.maxRetries,
            timeout: state.newCoordinator.timeout,
            costLimit: state.newCoordinator.costLimit,
          },
          tools: ['mcp__vibestudio__*'], // Allow all vibestudio MCP tools
          tags: ['coordinator'],
        };

        const coordinatorResponse = await apiClient.post(
          `/projects/${state.projectId}/components`,
          coordinatorData
        );
        coordinatorId = coordinatorResponse.data.id;
      }

      if (!coordinatorId) {
        throw new Error('No coordinator selected or created');
      }

      // Create workflow
      const workflowData = {
        name: state.name,
        description: state.description,
        coordinatorId,
        componentAssignments: state.componentAssignments,
        triggerConfig: state.triggerConfig,
        active: state.active,
      };

      await apiClient.post(`/projects/${state.projectId}/workflows`, workflowData);

      // Success!
      resetWizard();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to create workflow');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = () => {
    if (state.coordinatorMode === 'existing') {
      return !!state.coordinatorId;
    } else if (state.coordinatorMode === 'new' && state.newCoordinator) {
      return (
        state.newCoordinator.name.trim().length > 0 &&
        state.newCoordinator.instructions.trim().length > 0
      );
    }
    return false;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth data-testid="workflow-wizard-modal">
      <DialogTitle>Create New Workflow</DialogTitle>

      <DialogContent>
        <Box sx={{ width: '100%', pt: 2 }}>
          <Stepper activeStep={currentStep - 1} sx={{ mb: 4 }} data-testid="step-indicator">
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {currentStep === 1 && <WorkflowShellForm projects={projects} />}
          {currentStep === 2 && <ComponentVersionSelector />}
          {currentStep === 3 && <CoordinatorSelector />}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>

        {currentStep > 1 && (
          <Button onClick={handleBack} disabled={loading}>
            Back
          </Button>
        )}

        {currentStep < 3 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!canProceedToStep((currentStep + 1) as any) || loading}
          >
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!canSubmit() || loading}
            startIcon={loading ? <CircularProgress size={16} /> : null}
          >
            {loading ? 'Creating...' : 'Create Workflow'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export const WorkflowCreationWizard: React.FC<WorkflowCreationWizardProps> = ({
  open,
  onClose,
  projectId,
  projects,
  onSuccess,
}) => {
  return (
    <WorkflowWizardProvider projectId={projectId}>
      <WizardContent open={open} onClose={onClose} projects={projects} onSuccess={onSuccess} />
    </WorkflowWizardProvider>
  );
};
