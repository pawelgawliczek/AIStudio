import React from 'react';
import {
  Box,
  TextField,
  Typography,
  Paper,
  Alert,
} from '@mui/material';
import { useWorkflowWizard } from '../../contexts/WorkflowWizardContext';
import { terminology } from '../../utils/terminology';

interface WorkflowShellFormProps {
  projects: Array<{ id: string; name: string }>;
}

export const WorkflowShellForm: React.FC<WorkflowShellFormProps> = ({ projects }) => {
  const { state, updateState, canProceedToStep } = useWorkflowWizard();

  // Find the current project to display its name (with safety check)
  const currentProject = Array.isArray(projects) ? projects.find(p => p.id === state.projectId) : undefined;

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateState({ name: event.target.value });
  };

  const handleDescriptionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateState({ description: event.target.value });
  };

  const isValid = canProceedToStep(2);

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Step 1: {terminology.team} Information
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Provide basic information about your {terminology.team.toLowerCase()}. This will help identify and organize your automation.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <TextField
          label={`${terminology.team} Name`}
          name="name"
          value={state.name}
          onChange={handleNameChange}
          required
          fullWidth
          placeholder={`e.g., Story Implementation ${terminology.team}`}
          helperText={`A descriptive name for your ${terminology.team.toLowerCase()}`}
          error={state.name.trim().length === 0}
        />

        <TextField
          label="Description"
          name="description"
          value={state.description}
          onChange={handleDescriptionChange}
          fullWidth
          multiline
          rows={3}
          placeholder={`Describe the purpose and scope of this ${terminology.team.toLowerCase()}...`}
          helperText={`Optional: Explain what this ${terminology.team.toLowerCase()} does and when it should be used`}
        />

        <TextField
          label="Project"
          value={currentProject?.name || 'Loading project...'}
          fullWidth
          disabled
          helperText={`${terminology.team} will be created for this project`}
          InputProps={{
            readOnly: true,
          }}
        />

        {!isValid && (
          <Alert severity="warning">
            Please fill in the {terminology.team.toLowerCase()} name to proceed to the next step.
          </Alert>
        )}

        {isValid && (
          <Alert severity="success">Ready to proceed to {terminology.agent.toLowerCase()} selection!</Alert>
        )}
      </Box>
    </Paper>
  );
};
