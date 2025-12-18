/**
 * ST-160: Question Modal
 *
 * Modal for answering pending questions from Claude Code agents.
 * Supports quick answers and handoff to session.
 */

import {
  QuestionAnswer,
  Send,
  OpenInNew,
  Close,
  AccessTime,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
} from '@mui/material';
import React, { useState } from 'react';
import { type QuestionEvent } from '../../hooks/useSessionStream';

interface QuestionModalProps {
  open: boolean;
  question: QuestionEvent | null;
  onClose: () => void;
  onAnswer: (questionId: string, answer: string) => Promise<void>;
  onHandoff?: (sessionId: string) => void;
}

const QuestionModal: React.FC<QuestionModalProps> = ({
  open,
  question,
  onClose,
  onAnswer,
  onHandoff,
}) => {
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick answer suggestions based on common patterns
  const quickAnswers = [
    { label: 'Yes', value: 'Yes, please proceed.' },
    { label: 'No', value: 'No, please do not proceed.' },
    { label: 'Skip', value: 'Skip this step and continue.' },
    { label: 'Cancel', value: 'Cancel the operation.' },
  ];

  const handleSubmit = async () => {
    if (!question || !answer.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onAnswer(question.questionId, answer.trim());
      setAnswer('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit answer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAnswer = (value: string) => {
    setAnswer(value);
  };

  const handleHandoff = () => {
    if (question?.sessionId && onHandoff) {
      onHandoff(question.sessionId);
      onClose();
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    } catch {
      return timestamp;
    }
  };

  if (!question) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { overflow: 'hidden' },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <QuestionAnswer color="warning" />
        <Box flex={1}>Agent Question</Box>
        <IconButton size="small" onClick={onClose}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* Question metadata */}
        <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
          <Chip
            size="small"
            icon={<AccessTime />}
            label={formatTimestamp(question.timestamp)}
            variant="outlined"
          />
          <Chip
            size="small"
            label={question.executionType}
            color={question.executionType.includes('native') ? 'info' : 'default'}
          />
          {question.canHandoff && (
            <Chip size="small" label="Handoff Available" color="success" />
          )}
        </Box>

        {/* Question text */}
        <Box
          sx={{
            p: 2,
            bgcolor: 'warning.dark',
            borderRadius: 1,
            mb: 3,
          }}
        >
          <Typography
            variant="body1"
            sx={{ color: 'warning.contrastText', whiteSpace: 'pre-wrap' }}
          >
            {question.questionText}
          </Typography>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Quick answers */}
        <Typography variant="subtitle2" gutterBottom>
          Quick Answers
        </Typography>
        <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
          {quickAnswers.map((qa) => (
            <Chip
              key={qa.label}
              label={qa.label}
              onClick={() => handleQuickAnswer(qa.value)}
              sx={{ cursor: 'pointer' }}
              color={answer === qa.value ? 'primary' : 'default'}
            />
          ))}
        </Box>

        {/* Answer input */}
        <TextField
          fullWidth
          multiline
          rows={3}
          label="Your Answer"
          placeholder="Type your response to the agent..."
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={isSubmitting}
          sx={{ mb: 2 }}
        />

        {/* Error display */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Handoff option */}
        {question.canHandoff && onHandoff && (
          <Box
            sx={{
              p: 2,
              bgcolor: 'action.hover',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography variant="subtitle2">Take Over Session</Typography>
              <Typography variant="caption" color="text.secondary">
                Jump into the Claude Code session to handle this interactively
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<OpenInNew />}
              onClick={handleHandoff}
              disabled={isSubmitting}
            >
              Handoff
            </Button>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={isSubmitting ? <CircularProgress size={16} /> : <Send />}
          onClick={handleSubmit}
          disabled={!answer.trim() || isSubmitting}
        >
          {isSubmitting ? 'Sending...' : 'Send Answer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default QuestionModal;
