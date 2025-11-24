import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Paper,
  IconButton,
  Alert,
  Chip,
  Stack,
  Card,
  CardContent,
  CardActions,
  Divider,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { useWorkflowWizard } from '../../contexts/WorkflowWizardContext';
import { Component, ComponentVersion, ComponentAssignment } from '../../types/workflow-wizard';
import { apiClient } from '../../services/api-client';

export const ComponentVersionSelector: React.FC = () => {
  const {
    state,
    addComponentAssignment,
    removeComponentAssignment,
    updateComponentAssignment,
    canProceedToStep,
  } = useWorkflowWizard();

  const [components, setComponents] = useState<Component[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [versions, setVersions] = useState<ComponentVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ComponentVersion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  // Load all components on mount
  useEffect(() => {
    loadComponents();
  }, [state.projectId]);

  const loadComponents = async () => {
    if (!state.projectId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/projects/${state.projectId}/components`);
      setComponents(response.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load components');
    } finally {
      setLoading(false);
    }
  };

  // Load versions when component is selected
  const handleComponentSelect = async (componentId: string) => {
    const component = components.find((c) => c.id === componentId);
    if (!component) return;

    setSelectedComponent(component);
    setSelectedVersion(null);
    setDuplicateError(null);

    // Check if component name already exists
    const isDuplicate = state.componentAssignments.some(
      (ca) => ca.componentName === component.name
    );

    if (isDuplicate) {
      setDuplicateError(`Component "${component.name}" is already assigned to this workflow`);
      return;
    }

    // Load versions for this component
    setLoading(true);
    try {
      const response = await apiClient.get(`/components/${componentId}/versions`);
      const versionList = response.data || [];
      setVersions(versionList);

      // Auto-select latest version
      if (versionList.length > 0) {
        setSelectedVersion(versionList[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load component versions');
    } finally {
      setLoading(false);
    }
  };

  const handleVersionSelect = (versionId: string) => {
    const version = versions.find((v) => v.id === versionId);
    if (version) {
      setSelectedVersion(version);
    }
  };

  const handleAddComponent = () => {
    if (!selectedComponent || !selectedVersion) return;

    const assignment: ComponentAssignment = {
      componentName: selectedComponent.name,
      componentId: selectedComponent.id,
      versionId: selectedVersion.id,
      version: selectedVersion.version,
      versionMajor: selectedVersion.versionMajor,
      versionMinor: selectedVersion.versionMinor,
    };

    addComponentAssignment(assignment);
    setSelectedComponent(null);
    setSelectedVersion(null);
    setVersions([]);
    setDuplicateError(null);
  };

  const handleRemoveComponent = (index: number) => {
    removeComponentAssignment(index);
  };

  const isValid = canProceedToStep(3);

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Step 2: Select Components & Versions
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose which components this workflow can use and their specific versions. Component names must be unique within a workflow.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 4 }}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Add Component
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <FormControl sx={{ minWidth: 250 }} size="small">
                <InputLabel>Component</InputLabel>
                <Select
                  value={selectedComponent?.id || ''}
                  onChange={(e) => handleComponentSelect(e.target.value)}
                  label="Component"
                  disabled={loading}
                >
                  {components
                    .filter((c) => !state.componentAssignments.some((ca) => ca.componentName === c.name))
                    .map((component) => (
                      <MenuItem key={component.id} value={component.id}>
                        {component.name} ({component.version})
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              {selectedComponent && (
                <FormControl sx={{ minWidth: 150 }} size="small">
                  <InputLabel>Version</InputLabel>
                  <Select
                    value={selectedVersion?.id || ''}
                    onChange={(e) => handleVersionSelect(e.target.value)}
                    label="Version"
                    disabled={loading || versions.length === 0}
                  >
                    {versions.map((version) => (
                      <MenuItem key={version.id} value={version.id}>
                        {version.version}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddComponent}
                disabled={!selectedComponent || !selectedVersion || !!duplicateError}
              >
                Add Component
              </Button>
            </Box>

            {duplicateError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {duplicateError}
              </Alert>
            )}
          </CardContent>
        </Card>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Box>
        <Typography variant="subtitle1" gutterBottom>
          Selected Components ({state.componentAssignments.length})
        </Typography>

        {state.componentAssignments.length === 0 ? (
          <Alert severity="info">
            No components added yet. Add at least one component to proceed to the next step.
          </Alert>
        ) : (
          <Stack spacing={2}>
            {state.componentAssignments.map((assignment, index) => (
              <Card key={index} variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle2">{assignment.componentName}</Typography>
                      <Chip label={assignment.version} size="small" sx={{ mt: 1 }} />
                    </Box>
                    <IconButton
                      color="error"
                      onClick={() => handleRemoveComponent(index)}
                      aria-label="Remove component"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Box>

      {isValid && (
        <Alert severity="success" sx={{ mt: 3 }}>
          Ready to proceed to coordinator selection!
        </Alert>
      )}

      {!isValid && state.componentAssignments.length === 0 && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          Please add at least one component to proceed.
        </Alert>
      )}
    </Paper>
  );
};
