import React from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Paper,
  Alert,
} from '@mui/material';
import { useWorkflowWizard } from '../../contexts/WorkflowWizardContext';

interface WorkflowShellFormProps {
  projects: Array<{ id: string; name: string }>;
}

export const WorkflowShellForm: React.FC<WorkflowShellFormProps> = ({ projects }) => {
  const { state, updateState, canProceedToStep } = useWorkflowWizard();

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateState({ name: event.target.value });
  };

  const handleDescriptionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateState({ description: event.target.value });
  };

  const handleProjectChange = (event: any) => {
    updateState({ projectId: event.target.value });
  };

  const isValid = canProceedToStep(2);

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Step 1: Workflow Information
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Provide basic information about your workflow. This will help identify and organize your automation.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <TextField
          label="Workflow Name"
          value={state.name}
          onChange={handleNameChange}
          required
          fullWidth
          placeholder="e.g., Story Implementation Workflow"
          helperText="A descriptive name for your workflow"
          error={state.name.trim().length === 0}
        />

        <TextField
          label="Description"
          value={state.description}
          onChange={handleDescriptionChange}
          fullWidth
          multiline
          rows={3}
          placeholder="Describe the purpose and scope of this workflow..."
          helperText="Optional: Explain what this workflow does and when it should be used"
        />

        <FormControl fullWidth required error={!state.projectId}>
          <InputLabel>Project</InputLabel>
          <Select value={state.projectId} onChange={handleProjectChange} label="Project">
            {projects.map((project) => (
              <MenuItem key={project.id} value={project.id}>
                {project.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {!isValid && (
          <Alert severity="warning">
            Please fill in the required fields (Name and Project) to proceed to the next step.
          </Alert>
        )}

        {isValid && (
          <Alert severity="success">Ready to proceed to component selection!</Alert>
        )}
      </Box>
    </Paper>
  );
};
