/**
 * WorkflowControlPanel Component
 * ST-195: Workflow control buttons for pause/resume/repeat/skip/cancel
 *
 * Two variants:
 * - 'header': Compact ButtonGroup for inline display in header
 * - 'panel': Full panel with status display and action descriptions
 */

import {
  Box,
  Button,
  ButtonGroup,
  Typography,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
} from '@mui/material';
import React, { useState } from 'react';
import type { RunnerStatus } from '../../services/runner.service';
import { useRunnerControl } from './hooks/useRunnerControl';

// Repeat Step Modal
interface RepeatStepModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (feedback?: string, reason?: string) => void;
  currentState?: string;
}

const RepeatStepModal: React.FC<RepeatStepModalProps> = ({
  open,
  onClose,
  onConfirm,
  currentState,
}) => {
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');

  const handleConfirm = () => {
    onConfirm(feedback || undefined, reason || undefined);
    setReason('');
    setFeedback('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-testid="repeat-step-modal">
      <DialogTitle>🔄 Repeat Current Step</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Current State: <strong>{currentState || 'Unknown'}</strong>
          </Typography>
        </Box>
        <TextField
          fullWidth
          label="Reason (optional)"
          placeholder="Previous output was incomplete"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          margin="normal"
          size="small"
        />
        <TextField
          fullWidth
          label="Feedback for Agent"
          placeholder="Please include error handling for edge cases..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          margin="normal"
          multiline
          rows={4}
          size="small"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleConfirm} variant="contained" data-testid="confirm-repeat-btn">
          🔄 Repeat Step
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Skip Phase Modal
interface SkipPhaseModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (skipToState?: string) => void;
  currentState?: string;
  states?: Array<{ id: string; name: string; order: number }>;
}

const SkipPhaseModal: React.FC<SkipPhaseModalProps> = ({
  open,
  onClose,
  onConfirm,
  currentState,
  states = [],
}) => {
  const [skipToState, setSkipToState] = useState<string>('next');

  const handleConfirm = () => {
    onConfirm(skipToState === 'next' ? undefined : skipToState);
    setSkipToState('next');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-testid="skip-phase-modal">
      <DialogTitle>⏭ Skip / Advance</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            ℹ️ You can advance to the next phase or skip to a specific state.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Current: <strong>{currentState || 'Unknown'}</strong>
          </Typography>
        </Box>
        <FormControl component="fieldset">
          <FormLabel component="legend">Skip to State (Optional)</FormLabel>
          <RadioGroup value={skipToState} onChange={(e) => setSkipToState(e.target.value)}>
            <FormControlLabel
              value="next"
              control={<Radio size="small" />}
              label="Just advance to next phase"
            />
            {states.map((state) => (
              <FormControlLabel
                key={state.id}
                value={state.name}
                control={<Radio size="small" />}
                label={`Skip to: ${state.name} (State ${state.order})`}
              />
            ))}
          </RadioGroup>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleConfirm} variant="contained" data-testid="confirm-skip-btn">
          ⏭ Skip
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Main Component Props
interface WorkflowControlPanelProps {
  runId: string;
  variant?: 'header' | 'panel';
  states?: Array<{ id: string; name: string; order: number }>;
  onStatusChange?: (status: RunnerStatus) => void;
}

export const WorkflowControlPanel: React.FC<WorkflowControlPanelProps> = ({
  runId,
  variant = 'header',
  states = [],
  onStatusChange,
}) => {
  const {
    status,
    isLoadingStatus,
    pause,
    resume,
    repeat,
    advance,
    cancel,
    isPausing,
    isResuming,
    isRepeating,
    isAdvancing,
    isCancelling,
  } = useRunnerControl({ runId });

  const [repeatModalOpen, setRepeatModalOpen] = useState(false);
  const [skipModalOpen, setSkipModalOpen] = useState(false);

  // Determine which buttons are enabled based on status
  const getButtonStates = () => {
    const runnerState = status?.status || 'initializing';
    return {
      pause: runnerState === 'running',
      resume: runnerState === 'paused',
      repeat: ['running', 'paused', 'failed'].includes(runnerState),
      skip: ['running', 'paused'].includes(runnerState),
      cancel: ['running', 'paused'].includes(runnerState),
    };
  };

  const buttonStates = getButtonStates();

  const handlePause = async () => {
    await pause('Manual pause via control panel');
    onStatusChange?.(status!);
  };

  const handleResume = async () => {
    await resume();
    onStatusChange?.(status!);
  };

  const handleRepeat = async (feedback?: string, reason?: string) => {
    await repeat({ feedback, reason });
    onStatusChange?.(status!);
  };

  const handleSkip = async (skipToState?: string) => {
    await advance({ skipToState });
    onStatusChange?.(status!);
  };

  const handleCancel = async () => {
    await cancel('Cancelled via control panel');
    onStatusChange?.(status!);
  };

  const checkpoint = status?.checkpoint as { currentState?: string; completedStates?: string[] } | undefined;
  const currentStateName = checkpoint?.currentState || 'Unknown';
  const runnerState = status?.status || 'initializing';

  if (isLoadingStatus && !status) {
    return (
      <Box display="flex" alignItems="center" gap={1} data-testid="workflow-control-panel">
        <CircularProgress size={20} />
        <Typography variant="body2">Loading...</Typography>
      </Box>
    );
  }

  // Header variant - compact ButtonGroup
  if (variant === 'header') {
    return (
      <>
        <ButtonGroup size="small" variant="outlined" data-testid="workflow-control-panel">
          <Button
            data-testid="pause-btn"
            disabled={!buttonStates.pause || isPausing}
            onClick={handlePause}
            startIcon={isPausing ? <CircularProgress size={14} /> : null}
          >
            ⏸ Pause
          </Button>
          <Button
            data-testid="resume-btn"
            disabled={!buttonStates.resume || isResuming}
            onClick={handleResume}
            startIcon={isResuming ? <CircularProgress size={14} /> : null}
          >
            ▶ Resume
          </Button>
          <Button
            data-testid="repeat-btn"
            disabled={!buttonStates.repeat || isRepeating}
            onClick={() => setRepeatModalOpen(true)}
            startIcon={isRepeating ? <CircularProgress size={14} /> : null}
          >
            🔄 Repeat
          </Button>
          <Button
            data-testid="skip-btn"
            disabled={!buttonStates.skip || isAdvancing}
            onClick={() => setSkipModalOpen(true)}
            startIcon={isAdvancing ? <CircularProgress size={14} /> : null}
          >
            ⏭ Skip
          </Button>
          <Button
            data-testid="cancel-btn"
            disabled={!buttonStates.cancel || isCancelling}
            onClick={handleCancel}
            color="error"
            startIcon={isCancelling ? <CircularProgress size={14} /> : null}
          >
            ⏹ Cancel
          </Button>
        </ButtonGroup>

        <RepeatStepModal
          open={repeatModalOpen}
          onClose={() => setRepeatModalOpen(false)}
          onConfirm={handleRepeat}
          currentState={currentStateName}
        />

        <SkipPhaseModal
          open={skipModalOpen}
          onClose={() => setSkipModalOpen(false)}
          onConfirm={handleSkip}
          currentState={currentStateName}
          states={states}
        />
      </>
    );
  }

  // Panel variant - full with status display
  return (
    <>
      <Box
        data-testid="workflow-control-panel"
        sx={{
          p: 3,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="h6" gutterBottom>
          WORKFLOW CONTROLS
        </Typography>

        {/* Status Display */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Status:{' '}
            {runnerState === 'paused' && '⏸ '}
            {runnerState === 'running' && '▶ '}
            {runnerState === 'failed' && '✕ '}
            {runnerState === 'completed' && '✓ '}
            <strong>{runnerState.toUpperCase()}</strong> at "{currentStateName}"
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Progress: {checkpoint?.completedStates?.length || 0}/{states.length} states
          </Typography>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button
            data-testid="resume-btn"
            fullWidth
            variant="contained"
            disabled={!buttonStates.resume || isResuming}
            onClick={handleResume}
            startIcon={isResuming ? <CircularProgress size={20} /> : <span>▶</span>}
          >
            Resume Workflow
          </Button>

          <Box>
            <Button
              data-testid="repeat-btn"
              fullWidth
              variant="outlined"
              disabled={!buttonStates.repeat || isRepeating}
              onClick={() => setRepeatModalOpen(true)}
              startIcon={isRepeating ? <CircularProgress size={20} /> : <span>🔄</span>}
            >
              Repeat Step
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              Retry current step with optional feedback
            </Typography>
          </Box>

          <Box>
            <Button
              data-testid="skip-btn"
              fullWidth
              variant="outlined"
              disabled={!buttonStates.skip || isAdvancing}
              onClick={() => setSkipModalOpen(true)}
              startIcon={isAdvancing ? <CircularProgress size={20} /> : <span>⏭</span>}
            >
              Skip Phase
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              Skip current phase or jump to state
            </Typography>
          </Box>

          <Button
            data-testid="cancel-btn"
            fullWidth
            variant="outlined"
            color="error"
            disabled={!buttonStates.cancel || isCancelling}
            onClick={handleCancel}
            startIcon={isCancelling ? <CircularProgress size={20} /> : <span>⏹</span>}
          >
            Cancel Run
          </Button>
        </Box>
      </Box>

      <RepeatStepModal
        open={repeatModalOpen}
        onClose={() => setRepeatModalOpen(false)}
        onConfirm={handleRepeat}
        currentState={currentStateName}
      />

      <SkipPhaseModal
        open={skipModalOpen}
        onClose={() => setSkipModalOpen(false)}
        onConfirm={handleSkip}
        currentState={currentStateName}
        states={states}
      />
    </>
  );
};
