/**
 * ST-182: Master Transcript Panel
 *
 * Displays master session transcripts with live streaming support.
 * Supports multiple sessions (context compaction creates new sessions).
 *
 * Features:
 * - Live streaming from laptop agent via WebSocket
 * - Multiple session support (tabs for each compacted session)
 * - Parsed JSONL view (conversation turns)
 * - Raw JSONL view (for debugging)
 * - Connection status indicator
 */

import {
  PlayArrow,
  Stop,
  ExpandMore,
  ExpandLess,
  Terminal,
  Code,
  Wifi,
  WifiOff,
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
import { Socket } from 'socket.io-client';
import { TranscriptParser, ConversationTurn } from '../../utils/transcript-parser';

// =============================================================================
// Types
// =============================================================================

interface MasterSession {
  index: number;
  filePath: string;
  isStreaming: boolean;
  lines: TranscriptLine[];
  parsedTurns: ConversationTurn[];
  error?: string;
}

interface TranscriptLine {
  line: string;
  sequenceNumber: number;
  isHistorical: boolean;
}

export interface MasterTranscriptPanelProps {
  runId: string;
  masterTranscriptPaths: string[];
  socket: Socket | null;
  isAgentOnline?: boolean;
  agentHostname?: string;
  defaultExpanded?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export const MasterTranscriptPanel: React.FC<MasterTranscriptPanelProps> = ({
  runId,
  masterTranscriptPaths,
  socket,
  isAgentOnline = false,
  agentHostname,
  defaultExpanded = false,
}) => {
  // State
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activeSession, setActiveSession] = useState(0);
  const [viewMode, setViewMode] = useState<'parsed' | 'raw'>('parsed');
  const [sessions, setSessions] = useState<MasterSession[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  // Refs
  const contentRef = useRef<HTMLDivElement>(null);
  const parser = useRef(new TranscriptParser());

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
        isStreaming: false,
        lines: [],
        parsedTurns: [],
      }))
    );
  }, [masterTranscriptPaths]);

  // Set up WebSocket listeners
  useEffect(() => {
    if (!socket) return;

    // Streaming started
    const handleStreamingStarted = (data: {
      runId: string;
      sessionIndex: number;
      filePath: string;
      fileSize: number;
    }) => {
      if (data.runId !== runId) return;

      setSessions((prev) =>
        prev.map((s) =>
          s.index === data.sessionIndex ? { ...s, isStreaming: true, error: undefined } : s
        )
      );
      setIsConnecting(false);
    };

    // New lines (live)
    const handleLines = (data: {
      runId: string;
      sessionIndex: number;
      lines: Array<{ line: string; sequenceNumber: number }>;
      isHistorical: boolean;
    }) => {
      if (data.runId !== runId) return;

      setSessions((prev) =>
        prev.map((s) => {
          if (s.index !== data.sessionIndex) return s;

          const newLines = data.lines.map((l) => ({
            ...l,
            isHistorical: data.isHistorical,
          }));

          const allLines = [...s.lines, ...newLines];

          // Parse the combined JSONL
          const rawContent = allLines.map((l) => l.line).join('\n');
          let parsedTurns: ConversationTurn[] = [];
          try {
            const parsed = parser.current.parseJSONL(rawContent);
            parsedTurns = parsed.turns;
          } catch (e) {
            // Ignore parse errors for partial content
          }

          return { ...s, lines: allLines, parsedTurns };
        })
      );

      // Auto-scroll to bottom
      if (contentRef.current) {
        contentRef.current.scrollTop = contentRef.current.scrollHeight;
      }
    };

    // Batch (historical content)
    const handleBatch = (data: {
      runId: string;
      sessionIndex: number;
      lines: Array<{ line: string; sequenceNumber: number }>;
      isHistorical: boolean;
    }) => {
      if (data.runId !== runId) return;
      // Treat batch same as lines
      handleLines(data);
    };

    // Error
    const handleError = (data: {
      runId: string;
      sessionIndex: number;
      error: string;
      code: string;
    }) => {
      if (data.runId !== runId) return;

      setSessions((prev) =>
        prev.map((s) =>
          s.index === data.sessionIndex
            ? { ...s, isStreaming: false, error: data.error }
            : s
        )
      );
      setIsConnecting(false);
    };

    // Stopped
    const handleStopped = (data: { runId: string; sessionIndex: number }) => {
      if (data.runId !== runId) return;

      setSessions((prev) =>
        prev.map((s) =>
          s.index === data.sessionIndex ? { ...s, isStreaming: false } : s
        )
      );
    };

    // Subscribe to events
    socket.on('master-transcript:streaming_started', handleStreamingStarted);
    socket.on('master-transcript:lines', handleLines);
    socket.on('master-transcript:batch', handleBatch);
    socket.on('master-transcript:error', handleError);
    socket.on('master-transcript:stopped', handleStopped);

    return () => {
      socket.off('master-transcript:streaming_started', handleStreamingStarted);
      socket.off('master-transcript:lines', handleLines);
      socket.off('master-transcript:batch', handleBatch);
      socket.off('master-transcript:error', handleError);
      socket.off('master-transcript:stopped', handleStopped);
    };
  }, [socket, runId]);

  // Start streaming for a session
  const startStreaming = useCallback(
    (sessionIndex: number) => {
      const session = sessions[sessionIndex];
      if (!session || !socket) return;

      setIsConnecting(true);

      socket.emit('master-transcript:subscribe', {
        runId,
        sessionIndex,
        filePath: session.filePath,
        fromBeginning: true,
      });
    },
    [socket, runId, sessions]
  );

  // Stop streaming for a session
  const stopStreaming = useCallback(
    (sessionIndex: number) => {
      if (!socket) return;

      socket.emit('master-transcript:unsubscribe', {
        runId,
        sessionIndex,
      });

      setSessions((prev) =>
        prev.map((s) =>
          s.index === sessionIndex ? { ...s, isStreaming: false } : s
        )
      );
    },
    [socket, runId]
  );

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
          {/* Agent status */}
          <Tooltip title={isAgentOnline ? `Connected: ${agentHostname}` : 'Laptop agent offline'}>
            <Chip
              icon={isAgentOnline ? <Wifi /> : <WifiOff />}
              label={isAgentOnline ? 'Online' : 'Offline'}
              size="small"
              color={isAgentOnline ? 'success' : 'default'}
              variant="outlined"
            />
          </Tooltip>

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
                      {session.isStreaming && (
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: 'error.main',
                            animation: 'pulse 1.5s infinite',
                            '@keyframes pulse': {
                              '0%': { opacity: 1 },
                              '50%': { opacity: 0.4 },
                              '100%': { opacity: 1 },
                            },
                          }}
                        />
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
              {/* Stream controls */}
              {isAgentOnline && (
                <>
                  {currentSession.isStreaming ? (
                    <Tooltip title="Stop streaming">
                      <IconButton
                        color="error"
                        onClick={() => stopStreaming(activeSession)}
                        size="small"
                      >
                        <Stop />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Start live streaming">
                      <IconButton
                        color="primary"
                        onClick={() => startStreaming(activeSession)}
                        disabled={isConnecting}
                        size="small"
                      >
                        {isConnecting ? <CircularProgress size={20} /> : <PlayArrow />}
                      </IconButton>
                    </Tooltip>
                  )}
                </>
              )}

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
                label={`${currentSession.lines.length} lines`}
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
                    {currentSession.isStreaming
                      ? 'Waiting for transcript data...'
                      : 'Click play to start streaming transcript'}
                  </Typography>
                )
              ) : (
                // Raw JSONL view
                currentSession.lines.length > 0 ? (
                  currentSession.lines.map((line, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        py: 0.5,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        opacity: line.isHistorical ? 0.7 : 1,
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
                        {line.sequenceNumber}
                      </Typography>
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{ color: 'text.primary', wordBreak: 'break-all' }}
                      >
                        {line.line}
                      </Typography>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {currentSession.isStreaming
                      ? 'Waiting for transcript data...'
                      : 'Click play to start streaming transcript'}
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
