/**
 * ST-160: Session Stream Viewer
 *
 * Real-time viewer for Claude Code session output.
 * Shows streaming text, tool calls, and session activity.
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Collapse,
  LinearProgress,
  Badge,
} from '@mui/material';
import {
  Terminal,
  ExpandMore,
  ExpandLess,
  QuestionAnswer,
  Build,
  Speed,
  Close,
  Fullscreen,
  FullscreenExit,
  ContentCopy,
} from '@mui/icons-material';
import { useSessionStream, type QuestionEvent } from '../../hooks/useSessionStream';

interface SessionStreamViewerProps {
  workflowRunId: string;
  componentRunId?: string;
  onQuestionDetected?: (question: QuestionEvent) => void;
  maxHeight?: number | string;
  showToolCalls?: boolean;
  autoScroll?: boolean;
}

const SessionStreamViewer: React.FC<SessionStreamViewerProps> = ({
  workflowRunId,
  componentRunId,
  onQuestionDetected,
  maxHeight = 400,
  showToolCalls = true,
  autoScroll = true,
}) => {
  const {
    isSubscribed,
    isConnected,
    events,
    textOutput,
    currentActivity,
    pendingQuestion,
    subscribe,
    unsubscribe,
    clearEvents,
  } = useSessionStream({ workflowRunId, componentRunId });

  const outputRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTools, setShowTools] = useState(showToolCalls);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [textOutput, events, autoScroll]);

  // Notify parent when question is detected
  useEffect(() => {
    if (pendingQuestion && onQuestionDetected) {
      onQuestionDetected(pendingQuestion);
    }
  }, [pendingQuestion, onQuestionDetected]);

  // Get activity color
  const getActivityColor = () => {
    switch (currentActivity) {
      case 'waiting_for_answer':
        return 'warning';
      case 'tool_call':
        return 'info';
      case 'running':
        return 'primary';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  // Get tool calls from events
  const toolCalls = events.filter((e) => e.type === 'tool_call' || e.type === 'tool_result');

  // Copy output to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(textOutput.join('\n'));
  };

  return (
    <Paper
      sx={{
        mt: 2,
        overflow: 'hidden',
        ...(isFullscreen && {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1300,
          mt: 0,
          borderRadius: 0,
        }),
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1.5,
          bgcolor: 'action.hover',
          borderBottom: expanded ? 1 : 0,
          borderColor: 'divider',
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Terminal fontSize="small" />
          <Typography variant="subtitle2">Live Session Output</Typography>

          {/* Connection status */}
          <Chip
            size="small"
            label={isConnected ? 'Connected' : 'Disconnected'}
            color={isConnected ? 'success' : 'default'}
            sx={{ height: 20, fontSize: '0.7rem' }}
          />

          {/* Activity status */}
          <Chip
            size="small"
            label={currentActivity}
            color={getActivityColor() as any}
            sx={{ height: 20, fontSize: '0.7rem' }}
          />

          {/* Pending question indicator */}
          {pendingQuestion && (
            <Badge badgeContent="!" color="warning">
              <QuestionAnswer fontSize="small" color="warning" />
            </Badge>
          )}
        </Box>

        <Box display="flex" alignItems="center" gap={0.5}>
          {/* Token count */}
          {events.length > 0 && (
            <Tooltip title="Events received">
              <Chip
                size="small"
                icon={<Speed fontSize="small" />}
                label={events.length}
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            </Tooltip>
          )}

          {/* Tool calls toggle */}
          {showToolCalls && (
            <Tooltip title={showTools ? 'Hide tool calls' : 'Show tool calls'}>
              <IconButton size="small" onClick={() => setShowTools(!showTools)}>
                <Badge badgeContent={toolCalls.length} color="info">
                  <Build fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
          )}

          {/* Copy button */}
          <Tooltip title="Copy output">
            <IconButton size="small" onClick={handleCopy}>
              <ContentCopy fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Fullscreen toggle */}
          <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            <IconButton size="small" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
            </IconButton>
          </Tooltip>

          {/* Expand/collapse toggle */}
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
        </Box>
      </Box>

      {/* Progress indicator when active */}
      {isSubscribed && currentActivity === 'running' && <LinearProgress />}

      <Collapse in={expanded}>
        {/* Tool calls panel */}
        {showTools && toolCalls.length > 0 && (
          <Box
            sx={{
              maxHeight: 100,
              overflowY: 'auto',
              p: 1,
              bgcolor: 'action.selected',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Tool Calls ({toolCalls.length})
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
              {toolCalls.slice(-10).map((event, index) => (
                <Chip
                  key={index}
                  size="small"
                  label={event.type === 'tool_call' ? String(event.payload.toolName || 'tool') : 'result'}
                  color={event.type === 'tool_call' ? 'info' : 'default'}
                  sx={{ height: 18, fontSize: '0.65rem' }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Main output area */}
        <Box
          ref={outputRef}
          sx={{
            maxHeight: isFullscreen ? 'calc(100vh - 150px)' : maxHeight,
            overflowY: 'auto',
            p: 2,
            bgcolor: '#1e1e1e',
            fontFamily: 'Monaco, Consolas, "Courier New", monospace',
            fontSize: '0.85rem',
            lineHeight: 1.6,
            color: '#d4d4d4',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {textOutput.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ color: '#6a9955' }}>
              {isSubscribed ? '// Waiting for session output...' : '// Not connected to session'}
            </Typography>
          ) : (
            textOutput.map((text, index) => (
              <Box key={index} component="span">
                {text}
              </Box>
            ))
          )}

          {/* Pending question highlight */}
          {pendingQuestion && (
            <Box
              sx={{
                mt: 2,
                p: 1.5,
                bgcolor: 'warning.dark',
                borderRadius: 1,
                color: 'warning.contrastText',
              }}
            >
              <Typography variant="subtitle2" gutterBottom>
                Question Detected:
              </Typography>
              <Typography variant="body2">{pendingQuestion.questionText}</Typography>
            </Box>
          )}
        </Box>

        {/* Footer with actions */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 1,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'action.hover',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {isSubscribed
              ? `Streaming session ${workflowRunId.slice(0, 8)}...`
              : 'Click to connect'}
          </Typography>

          <Box>
            {!isSubscribed ? (
              <Chip
                size="small"
                label="Connect"
                color="primary"
                onClick={subscribe}
                sx={{ cursor: 'pointer' }}
              />
            ) : (
              <Chip
                size="small"
                label="Disconnect"
                variant="outlined"
                onClick={unsubscribe}
                sx={{ cursor: 'pointer' }}
              />
            )}

            <Chip
              size="small"
              label="Clear"
              variant="outlined"
              onClick={clearEvents}
              sx={{ ml: 1, cursor: 'pointer' }}
            />
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default SessionStreamViewer;
