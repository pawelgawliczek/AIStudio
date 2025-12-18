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
import React, { useState } from 'react';
import { WorkflowWizardProvider, useWorkflowWizard } from '../../contexts/WorkflowWizardContext';
import { apiClient } from '../../services/api.client';
import { terminology } from '../../utils/terminology';
import { VersionBumpModal } from '../VersionBumpModal';
import { ComponentVersionSelector } from './ComponentVersionSelector';
import { WorkflowShellForm } from './WorkflowShellForm';

const STEPS = [`${terminology.team} Information`, `Select ${terminology.agents}`];

interface WorkflowCreationWizardProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projects: Array<{ id: string; name: string }>;
  onSuccess: () => void;
  editMode?: boolean; // AC8: Edit mode flag
  teamId?: string; // AC8: Team ID for editing
}

const WizardContent: React.FC<Omit<WorkflowCreationWizardProps, 'projectId'>> = ({
  open,
  onClose,
  projects,
  onSuccess,
  editMode,
  teamId,
}) => {
  const { state, currentStep, nextStep, previousStep, canProceedToStep, resetWizard, updateState } = useWorkflowWizard();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVersionBumpModal, setShowVersionBumpModal] = useState(false);
  const [existingTeam, setExistingTeam] = useState<any>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  // AC8: Fetch existing team data when in edit mode
  React.useEffect(() => {
    if (editMode && teamId && open && !dataLoaded) {
      const fetchTeamData = async () => {
        try {
          setLoading(true);
          const response = await apiClient.get(`/projects/${state.projectId}/workflows/${teamId}`);
          const team = response.data;
          setExistingTeam(team);

          // Pre-populate wizard state
          updateState({
            name: team.name,
            description: team.description || '',
            componentAssignments: team.componentAssignments || [],
          });

          setDataLoaded(true);
          setLoading(false);
        } catch (err: any) {
          setError(err.response?.data?.message || 'Failed to load team data');
          setLoading(false);
        }
      };

      fetchTeamData();
    }
  }, [editMode, teamId, open, dataLoaded, state.projectId, updateState]);

  const handleNext = () => {
    if (currentStep < 2) {
      nextStep();
    }
  };

  const handleBack = () => {
    previousStep();
  };

  const handleClose = () => {
    resetWizard();
    setDataLoaded(false);
    setExistingTeam(null);
    onClose();
  };

  const handleSubmit = async () => {
    // AC9: In edit mode, open version bump modal instead of direct update
    if (editMode && teamId) {
      setShowVersionBumpModal(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create workflow
      const workflowData = {
        name: state.name,
        description: state.description,
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
      setError(err.response?.data?.message || err.message || `Failed to create ${terminology.team.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  // AC9: Handle version bump success - update workflow and close
  const handleVersionBumpSuccess = async (newVersion: string) => {
    try {
      setLoading(true);
      // Update the workflow with the modified data (using teamId, not the version tag)
      const workflowData = {
        name: state.name,
        description: state.description,
        componentAssignments: state.componentAssignments,
      };

      // BUGFIX: Use teamId (the actual workflow UUID), not newVersion (the version tag like "v2.0")
      await apiClient.put(`/projects/${state.projectId}/workflows/${teamId}`, workflowData);

      setShowVersionBumpModal(false);
      resetWizard();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update team version');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = () => {
    // Team can be submitted if it has a name and at least one agent
    return state.name.trim().length > 0 && state.componentAssignments.length > 0;
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth data-testid="workflow-wizard-modal">
        <DialogTitle>{editMode ? 'Edit' : 'Create New'} {terminology.team}</DialogTitle>

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

        {currentStep < 2 ? (
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
            {loading ? (editMode ? 'Saving...' : 'Creating...') : (editMode ? 'Save Changes' : `Create ${terminology.team}`)}
          </Button>
        )}
      </DialogActions>
      </Dialog>

      {/* AC9: Version Bump Modal */}
      {editMode && teamId && existingTeam && (
        <VersionBumpModal
          isOpen={showVersionBumpModal}
          onClose={() => setShowVersionBumpModal(false)}
          entityType="workflow"
          entityId={teamId}
          entityName={existingTeam.name}
          currentVersion={existingTeam.version}
          onSuccess={handleVersionBumpSuccess}
        />
      )}
    </>
  );
};

export const WorkflowCreationWizard: React.FC<WorkflowCreationWizardProps> = ({
  open,
  onClose,
  projectId,
  projects,
  onSuccess,
  editMode,
  teamId,
}) => {
  return (
    <WorkflowWizardProvider projectId={projectId}>
      <WizardContent
        open={open}
        onClose={onClose}
        projects={projects}
        onSuccess={onSuccess}
        editMode={editMode}
        teamId={teamId}
      />
    </WorkflowWizardProvider>
  );
};
