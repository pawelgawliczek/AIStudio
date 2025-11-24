import React, { useState, useEffect } from 'react';
import {
  Box,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Paper,
  Alert,
  TextField,
  Slider,
  Grid,
} from '@mui/material';
import { useWorkflowWizard } from '../../contexts/WorkflowWizardContext';
import { Coordinator, ComponentVersion } from '../../types/workflow-wizard';
import { apiClient } from '../../services/api.client';
import { CoordinatorInstructionsEditor } from './CoordinatorInstructionsEditor';

const MODELS = [
  { value: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
  { value: 'claude-sonnet-3.5', label: 'Claude Sonnet 3.5' },
  { value: 'claude-haiku-3.5', label: 'Claude Haiku 3.5' },
  { value: 'claude-opus-3', label: 'Claude Opus 3' },
];

const DECISION_STRATEGIES = [
  { value: 'sequential', label: 'Sequential', description: 'Execute components one at a time in order' },
  { value: 'adaptive', label: 'Adaptive', description: 'Dynamically choose next component based on results' },
  { value: 'parallel', label: 'Parallel', description: 'Execute multiple components simultaneously' },
  { value: 'conditional', label: 'Conditional', description: 'Use conditional logic to decide execution flow' },
];

export const CoordinatorSelector: React.FC = () => {
  const { state, updateState } = useWorkflowWizard();

  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [selectedCoordinator, setSelectedCoordinator] = useState<Coordinator | null>(null);
  const [versions, setVersions] = useState<ComponentVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ComponentVersion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.coordinatorMode === 'existing') {
      loadCoordinators();
    }
  }, [state.coordinatorMode, state.projectId]);

  const loadCoordinators = async () => {
    if (!state.projectId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/projects/${state.projectId}/coordinators`);
      setCoordinators(response.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load coordinators');
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (_: React.MouseEvent<HTMLElement>, newMode: 'existing' | 'new' | null) => {
    if (newMode !== null) {
      updateState({ coordinatorMode: newMode });

      // Initialize new coordinator with defaults if switching to new mode
      if (newMode === 'new' && !state.newCoordinator) {
        updateState({
          newCoordinator: {
            name: '',
            instructions: '',
            modelId: 'claude-sonnet-4.5',
            temperature: 0.7,
            decisionStrategy: 'sequential',
            maxRetries: 3,
            timeout: 600,
            costLimit: 10,
          },
        });
      }
    }
  };

  const handleCoordinatorSelect = async (coordinatorId: string) => {
    const coordinator = coordinators.find((c) => c.id === coordinatorId);
    if (!coordinator) return;

    setSelectedCoordinator(coordinator);
    updateState({ coordinatorId });

    // Load versions for this coordinator
    setLoading(true);
    try {
      const response = await apiClient.get(`/versioning/components/${coordinatorId}/versions`);
      const versionList = response.data || [];
      setVersions(versionList);

      // Auto-select latest version
      if (versionList.length > 0) {
        setSelectedVersion(versionList[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load coordinator versions');
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

  const handleNewCoordinatorChange = (field: string, value: any) => {
    updateState({
      newCoordinator: {
        ...state.newCoordinator!,
        [field]: value,
      },
    });
  };

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Step 3: Select or Create Coordinator
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose an existing coordinator or create a new one. The coordinator orchestrates how components are executed.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 3 }}>
        <ToggleButtonGroup
          value={state.coordinatorMode}
          exclusive
          onChange={handleModeChange}
          aria-label="coordinator mode"
          fullWidth
        >
          <ToggleButton value="existing">Use Existing Coordinator</ToggleButton>
          <ToggleButton value="new">Create New Coordinator</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {state.coordinatorMode === 'existing' && (
        <Box>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Coordinator</InputLabel>
            <Select
              value={state.coordinatorId || ''}
              onChange={(e) => handleCoordinatorSelect(e.target.value)}
              label="Coordinator"
              disabled={loading}
            >
              {coordinators.map((coordinator) => (
                <MenuItem key={coordinator.id} value={coordinator.id}>
                  {coordinator.name} ({coordinator.version})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedCoordinator && versions.length > 0 && (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Version</InputLabel>
              <Select
                value={selectedVersion?.id || ''}
                onChange={(e) => handleVersionSelect(e.target.value)}
                label="Version"
              >
                {versions.map((version) => (
                  <MenuItem key={version.id} value={version.id}>
                    {version.version} {version.changeDescription && `- ${version.changeDescription}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {selectedCoordinator && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Coordinator Instructions Preview
              </Typography>
              <Paper
                variant="outlined"
                sx={{ p: 2, bgcolor: 'grey.50', maxHeight: 300, overflow: 'auto' }}
                data-testid="template-preview"
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                  {selectedCoordinator.operationInstructions}
                </Typography>
              </Paper>
            </Box>
          )}
        </Box>
      )}

      {state.coordinatorMode === 'new' && state.newCoordinator && (
        <Box>
          <TextField
            label="Coordinator Name"
            value={state.newCoordinator.name}
            onChange={(e) => handleNewCoordinatorChange('name', e.target.value)}
            required
            fullWidth
            sx={{ mb: 3 }}
            placeholder="e.g., Story Implementation Coordinator"
          />

          <CoordinatorInstructionsEditor
            instructions={state.newCoordinator.instructions}
            onChange={(value) => handleNewCoordinatorChange('instructions', value)}
            componentAssignments={state.componentAssignments}
          />

          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Model</InputLabel>
                <Select
                  value={state.newCoordinator.modelId}
                  onChange={(e) => handleNewCoordinatorChange('modelId', e.target.value)}
                  label="Model"
                >
                  {MODELS.map((model) => (
                    <MenuItem key={model.value} value={model.value}>
                      {model.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Decision Strategy</InputLabel>
                <Select
                  value={state.newCoordinator.decisionStrategy}
                  onChange={(e) => handleNewCoordinatorChange('decisionStrategy', e.target.value)}
                  label="Decision Strategy"
                >
                  {DECISION_STRATEGIES.map((strategy) => (
                    <MenuItem key={strategy.value} value={strategy.value}>
                      {strategy.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Typography gutterBottom>Temperature: {state.newCoordinator.temperature}</Typography>
              <Slider
                value={state.newCoordinator.temperature}
                onChange={(_, value) => handleNewCoordinatorChange('temperature', value)}
                min={0}
                max={1}
                step={0.1}
                marks
                valueLabelDisplay="auto"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Max Retries"
                type="number"
                value={state.newCoordinator.maxRetries}
                onChange={(e) => handleNewCoordinatorChange('maxRetries', parseInt(e.target.value))}
                fullWidth
                inputProps={{ min: 0, max: 10 }}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Timeout (seconds)"
                type="number"
                value={state.newCoordinator.timeout}
                onChange={(e) => handleNewCoordinatorChange('timeout', parseInt(e.target.value))}
                fullWidth
                inputProps={{ min: 60, max: 3600 }}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Cost Limit (USD)"
                type="number"
                value={state.newCoordinator.costLimit}
                onChange={(e) => handleNewCoordinatorChange('costLimit', parseFloat(e.target.value))}
                fullWidth
                inputProps={{ min: 0, max: 100, step: 0.1 }}
              />
            </Grid>
          </Grid>
        </Box>
      )}
    </Paper>
  );
};
