/**
 * ST-160: Session Handoff Modal
 *
 * Provides instructions and commands for taking over a Claude Code session.
 * Users can copy the resume command to run locally.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Alert,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  OpenInNew,
  Close,
  ContentCopy,
  Check,
  Terminal,
  Warning,
} from '@mui/icons-material';

interface SessionHandoffModalProps {
  open: boolean;
  sessionId: string;
  workflowRunId: string;
  componentName?: string;
  projectPath?: string;
  onClose: () => void;
  onConfirmHandoff: () => Promise<void>;
}

const SessionHandoffModal: React.FC<SessionHandoffModalProps> = ({
  open,
  sessionId,
  workflowRunId,
  componentName,
  projectPath = '.',
  onClose,
  onConfirmHandoff,
}) => {
  const [copied, setCopied] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  // Build the resume command
  const resumeCommand = `claude --resume ${sessionId}`;
  const fullCommand = `cd ${projectPath} && ${resumeCommand}`;

  // Copy to clipboard
  const handleCopy = async (text: string, type: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  // Confirm handoff
  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirmHandoff();
      setActiveStep(2);
    } catch (error) {
      console.error('Handoff failed:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  const steps = [
    {
      label: 'Review Session',
      content: (
        <Box>
          <Typography variant="body2" gutterBottom>
            You are about to take over the following Claude Code session:
          </Typography>
          <Box
            sx={{
              p: 2,
              mt: 1,
              bgcolor: 'action.hover',
              borderRadius: 1,
            }}
          >
            <Box display="flex" gap={1} flexWrap="wrap">
              <Chip size="small" label={`Session: ${sessionId.slice(0, 12)}...`} />
              {componentName && <Chip size="small" label={componentName} color="primary" />}
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              Workflow Run: {workflowRunId.slice(0, 8)}...
            </Typography>
          </Box>

          <Alert severity="warning" sx={{ mt: 2 }}>
            Taking over the session will pause the automated execution. The agent will wait
            for you to complete the task manually.
          </Alert>
        </Box>
      ),
    },
    {
      label: 'Confirm Handoff',
      content: (
        <Box>
          <Typography variant="body2" gutterBottom>
            Click "Confirm Handoff" to pause the automated session and prepare for manual takeover.
          </Typography>
          <Button
            variant="contained"
            color="warning"
            onClick={handleConfirm}
            disabled={isConfirming}
            sx={{ mt: 2 }}
          >
            {isConfirming ? 'Confirming...' : 'Confirm Handoff'}
          </Button>
        </Box>
      ),
    },
    {
      label: 'Resume Locally',
      content: (
        <Box>
          <Alert severity="success" sx={{ mb: 2 }}>
            Session paused successfully! Use the command below to resume in your terminal.
          </Alert>

          <Typography variant="subtitle2" gutterBottom>
            Full Command (with cd):
          </Typography>
          <Paper
            sx={{
              p: 1.5,
              bgcolor: '#1e1e1e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'Monaco, Consolas, monospace',
                color: '#d4d4d4',
                wordBreak: 'break-all',
              }}
            >
              {fullCommand}
            </Typography>
            <Tooltip title={copied === 'full' ? 'Copied!' : 'Copy'}>
              <IconButton
                size="small"
                onClick={() => handleCopy(fullCommand, 'full')}
                sx={{ color: 'grey.400' }}
              >
                {copied === 'full' ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Paper>

          <Typography variant="subtitle2" gutterBottom>
            Resume Command Only:
          </Typography>
          <Paper
            sx={{
              p: 1.5,
              bgcolor: '#1e1e1e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'Monaco, Consolas, monospace',
                color: '#d4d4d4',
              }}
            >
              {resumeCommand}
            </Typography>
            <Tooltip title={copied === 'resume' ? 'Copied!' : 'Copy'}>
              <IconButton
                size="small"
                onClick={() => handleCopy(resumeCommand, 'resume')}
                sx={{ color: 'grey.400' }}
              >
                {copied === 'resume' ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Paper>

          <Typography variant="subtitle2" gutterBottom>
            Session ID:
          </Typography>
          <Paper
            sx={{
              p: 1.5,
              bgcolor: '#1e1e1e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'Monaco, Consolas, monospace',
                color: '#d4d4d4',
                wordBreak: 'break-all',
              }}
            >
              {sessionId}
            </Typography>
            <Tooltip title={copied === 'session' ? 'Copied!' : 'Copy'}>
              <IconButton
                size="small"
                onClick={() => handleCopy(sessionId, 'session')}
                sx={{ color: 'grey.400' }}
              >
                {copied === 'session' ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Paper>

          <Alert severity="info" sx={{ mt: 2 }}>
            Run the command above in your terminal to continue the session interactively.
            When you're done, the workflow will continue with your changes.
          </Alert>
        </Box>
      ),
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Terminal color="primary" />
        <Box flex={1}>Session Handoff</Box>
        <IconButton size="small" onClick={onClose}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel>{step.label}</StepLabel>
              <StepContent>{step.content}</StepContent>
            </Step>
          ))}
        </Stepper>

        {activeStep < steps.length - 1 && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button
              disabled={activeStep === 0}
              onClick={() => setActiveStep((s) => s - 1)}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={() => setActiveStep((s) => s + 1)}
              disabled={activeStep === 1}
            >
              Next
            </Button>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>{activeStep === steps.length - 1 ? 'Done' : 'Cancel'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SessionHandoffModal;
