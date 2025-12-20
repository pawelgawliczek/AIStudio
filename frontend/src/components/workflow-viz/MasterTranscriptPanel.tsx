/**
 * ST-378: Master Transcript Panel - DB-First Implementation
 *
 * Displays master session transcripts from database with polling for running workflows.
 * Removes WebSocket dependency - all data comes from TranscriptLine DB table.
 *
 * Features:
 * - DB-first: Immediately fetches and displays transcript from database
 * - Polling: For running workflows, polls DB every 2-3 seconds for new lines
 * - Multiple session support (tabs for each compacted session)
 * - Parsed JSONL view (conversation turns)
 * - Raw JSONL view (for debugging)
 */

import {
  ExpandMore,
  ExpandLess,
  Terminal,
  Code,
  Refresh,
} from '@mui/icons-material';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tabs,
  Tab,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  CircularProgress,
  Alert,
  Collapse,
} from '@mui/material';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { transcriptsService, TranscriptLineItem } from '../../services/transcripts.service';
import { TranscriptParser, ConversationTurn } from '../../utils/transcript-parser';

// =============================================================================
// Types
// =============================================================================

interface MasterSession {
  index: number;
  filePath: string;
  lines: TranscriptLineItem[];
  parsedTurns: ConversationTurn[];
  error?: string;
  totalLines: number;
  isLoading: boolean;
}

export interface MasterTranscriptPanelProps {
  runId: string;
  projectId: string;
  masterTranscriptPaths: string[];
  workflowStatus?: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  defaultExpanded?: boolean;
}

const POLL_INTERVAL_MS = 2500; // 2.5 seconds

// =============================================================================
// Component
// =============================================================================

export const MasterTranscriptPanel: React.FC<MasterTranscriptPanelProps> = ({
  runId,
  projectId,
  masterTranscriptPaths,
  workflowStatus = 'completed',
  defaultExpanded = false,
}) => {
  // State
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activeSession, setActiveSession] = useState(0);
  const [viewMode, setViewMode] = useState<'parsed' | 'raw'>('parsed');
  const [sessions, setSessions] = useState<MasterSession[]>([]);

  // Refs
  const contentRef = useRef<HTMLDivElement>(null);
  const parser = useRef(new TranscriptParser());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize sessions from paths
  useEffect(() => {
    if (!masterTranscriptPaths || masterTranscriptPaths.length === 0) {
      setSessions([]);
      return;
    }

    setSessions(
      masterTranscriptPaths.map((filePath, index) => ({
        index,
        filePath,
        lines: [],
        parsedTurns: [],
        totalLines: 0,
        isLoading: false,
      }))
    );
  }, [masterTranscriptPaths]);

  // Fetch transcript lines from DB
  const fetchTranscriptLines = useCallback(async (sessionIndex: number) => {
    if (!projectId || !runId) return;

    setSessions((prev) =>
      prev.map((s) =>
        s.index === sessionIndex ? { ...s, isLoading: true, error: undefined } : s
      )
    );

    try {
      const response = await transcriptsService.getTranscriptLines(
        projectId,
        runId,
        sessionIndex
      );

      setSessions((prev) =>
        prev.map((s) => {
          if (s.index !== sessionIndex) return s;

          const lines = response.lines;

          // Parse the combined JSONL
          const rawContent = lines.map((l) => l.content).join('\n');
          let parsedTurns: ConversationTurn[] = [];
          try {
            if (rawContent.trim()) {
              const parsed = parser.current.parseJSONL(rawContent);
              parsedTurns = parsed.turns;
            }
          } catch (e) {
            console.error('Failed to parse transcript JSONL:', e);
          }

          return {
            ...s,
            lines,
            parsedTurns,
            totalLines: response.totalLines,
            isLoading: false,
          };
        })
      );

      // Auto-scroll to bottom
      if (contentRef.current) {
        contentRef.current.scrollTop = contentRef.current.scrollHeight;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setSessions((prev) =>
        prev.map((s) =>
          s.index === sessionIndex
            ? { ...s, isLoading: false, error: message }
            : s
        )
      );
    }
  }, [projectId, runId]);

  // Initial fetch when panel expands
  useEffect(() => {
    if (expanded && sessions.length > 0 && sessions[activeSession]) {
      const session = sessions[activeSession];
      // Only fetch if we haven't loaded any lines yet
      if (session.lines.length === 0 && !session.isLoading) {
        fetchTranscriptLines(activeSession);
      }
    }
  }, [expanded, activeSession, sessions, fetchTranscriptLines]);

  // Set up polling for running workflows
  useEffect(() => {
    // Only poll if workflow is running and panel is expanded
    const shouldPoll =
      expanded &&
      workflowStatus === 'running' &&
      sessions.length > 0 &&
      projectId &&
      runId;

    if (shouldPoll) {
      // Start polling
      pollIntervalRef.current = setInterval(() => {
        fetchTranscriptLines(activeSession);
      }, POLL_INTERVAL_MS);
    } else {
      // Stop polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [expanded, workflowStatus, activeSession, sessions.length, projectId, runId, fetchTranscriptLines]);

  // When workflow completes, do one final fetch
  useEffect(() => {
    if (
      expanded &&
      (workflowStatus === 'completed' || workflowStatus === 'failed') &&
      sessions.length > 0
    ) {
      // Final fetch for all sessions to ensure we have complete data
      sessions.forEach((session) => {
        fetchTranscriptLines(session.index);
      });
    }
  }, [workflowStatus, expanded, sessions.length, fetchTranscriptLines]);

  // Manual refresh
  const handleRefresh = useCallback(() => {
    if (sessions[activeSession]) {
      fetchTranscriptLines(activeSession);
    }
  }, [activeSession, sessions, fetchTranscriptLines]);

  // Get current session
  const currentSession = sessions[activeSession];

  // No transcripts available
  if (!masterTranscriptPaths || masterTranscriptPaths.length === 0) {
    return null;
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 2,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: expanded ? 'primary.main' : 'divider',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          bgcolor: 'action.hover',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.selected' },
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Terminal color="primary" />
          <Typography variant="subtitle1" fontWeight="medium">
            Master Session
          </Typography>
          <Chip
            label={`${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}
            size="small"
            variant="outlined"
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Workflow status */}
          <Chip
            label={workflowStatus}
            size="small"
            color={
              workflowStatus === 'running'
                ? 'primary'
                : workflowStatus === 'completed'
                ? 'success'
                : workflowStatus === 'failed'
                ? 'error'
                : 'default'
            }
            variant="outlined"
          />

          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
      </Box>

      {/* Content */}
      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          {/* Session tabs */}
          {sessions.length > 1 && (
            <Tabs
              value={activeSession}
              onChange={(_, v) => setActiveSession(v)}
              sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
            >
              {sessions.map((session, idx) => (
                <Tab
                  key={idx}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{idx === 0 ? 'Initial' : `Compacted ${idx}`}</span>
                      {session.isLoading && (
                        <CircularProgress size={12} />
                      )}
                    </Box>
                  }
                />
              ))}
            </Tabs>
          )}

          {/* Controls */}
          {currentSession && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              {/* Refresh button */}
              <Tooltip title="Refresh transcript">
                <IconButton
                  color="primary"
                  onClick={handleRefresh}
                  disabled={currentSession.isLoading}
                  size="small"
                >
                  {currentSession.isLoading ? <CircularProgress size={20} /> : <Refresh />}
                </IconButton>
              </Tooltip>

              {/* View mode toggle */}
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(_, v) => v && setViewMode(v)}
                size="small"
              >
                <ToggleButton value="parsed">
                  <Tooltip title="Conversation view">
                    <Terminal fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="raw">
                  <Tooltip title="Raw JSONL">
                    <Code fontSize="small" />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>

              {/* File path */}
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                {currentSession.filePath.split('/').pop()}
              </Typography>

              {/* Line count */}
              <Chip
                label={`${currentSession.lines.length} / ${currentSession.totalLines} lines`}
                size="small"
                variant="outlined"
              />
            </Box>
          )}

          {/* Error alert */}
          {currentSession?.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {currentSession.error}
            </Alert>
          )}

          {/* Content area */}
          {currentSession && (
            <Paper
              ref={contentRef}
              variant="outlined"
              sx={(theme) => ({
                p: 2,
                bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'grey.900',
                color: theme.palette.mode === 'dark' ? 'text.primary' : 'grey.100',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                minHeight: 200,
                maxHeight: 500,
                overflow: 'auto',
              })}
            >
              {viewMode === 'parsed' ? (
                // Parsed conversation view
                currentSession.parsedTurns.length > 0 ? (
                  currentSession.parsedTurns.map((turn, idx) => (
                    <Box key={idx} sx={{ mb: 2 }}>
                      {/* Turn header */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Chip
                          label={turn.type}
                          size="small"
                          color={
                            turn.type === 'user'
                              ? 'primary'
                              : turn.type === 'assistant'
                              ? 'success'
                              : 'default'
                          }
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {turn.timestamp}
                        </Typography>
                        {turn.usage && (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            ({turn.usage.inputTokens}in / {turn.usage.outputTokens}out)
                          </Typography>
                        )}
                      </Box>

                      {/* Content */}
                      {turn.content && (
                        <Typography
                          variant="body2"
                          sx={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            color: 'text.primary',
                            pl: 1,
                            borderLeft: '2px solid',
                            borderColor:
                              turn.type === 'user'
                                ? 'primary.main'
                                : turn.type === 'assistant'
                                ? 'success.main'
                                : 'text.disabled',
                          }}
                        >
                          {turn.content}
                        </Typography>
                      )}

                      {/* Tool calls */}
                      {turn.toolCalls && turn.toolCalls.length > 0 && (
                        <Box sx={{ mt: 1, pl: 2 }}>
                          {turn.toolCalls.map((tool, tidx) => (
                            <Chip
                              key={tidx}
                              label={tool.name}
                              size="small"
                              variant="outlined"
                              sx={{ mr: 0.5, mb: 0.5, fontSize: '0.7rem' }}
                            />
                          ))}
                        </Box>
                      )}
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {currentSession.isLoading
                      ? 'Loading transcript...'
                      : currentSession.lines.length === 0
                      ? 'No transcript data available yet'
                      : 'Parsing transcript...'}
                  </Typography>
                )
              ) : (
                // Raw JSONL view
                currentSession.lines.length > 0 ? (
                  currentSession.lines.map((line) => (
                    <Box
                      key={line.id}
                      sx={{
                        py: 0.5,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.disabled',
                          display: 'inline-block',
                          width: 50,
                          textAlign: 'right',
                          mr: 1,
                        }}
                      >
                        {line.lineNumber}
                      </Typography>
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{ color: 'text.primary', wordBreak: 'break-all' }}
                      >
                        {line.content}
                      </Typography>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {currentSession.isLoading
                      ? 'Loading transcript...'
                      : 'No transcript data available yet'}
                  </Typography>
                )
              )}
            </Paper>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default MasterTranscriptPanel;
