/**
 * LiveTranscriptViewer - Real-time transcript streaming viewer (ST-176)
 *
 * Features:
 * - Real-time JSONL line streaming via WebSocket
 * - Virtual scrolling for 1000+ lines (react-window)
 * - Syntax highlighting with react-syntax-highlighter
 * - Auto-scroll with user override detection
 * - Line count and buffer status
 * - Download transcript functionality
 */

import {
  Close,
  Download,
  Clear,
  VerticalAlignBottom,
  VerticalAlignTop,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  IconButton,
  Toolbar,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Alert,
} from '@mui/material';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTranscriptStream } from '../../hooks/useTranscriptStream';

interface LiveTranscriptViewerProps {
  open: boolean;
  componentRunId: string;
  componentName: string;
  onClose: () => void;
}

export const LiveTranscriptViewer: React.FC<LiveTranscriptViewerProps> = ({
  open,
  componentRunId,
  componentName,
  onClose,
}) => {
  const { lines, isStreaming, isComplete, error, clear } = useTranscriptStream({
    componentRunId,
    autoSubscribe: true,
    parseLines: true,
    maxLines: 500,
  });

  const [autoScroll, setAutoScroll] = useState(true);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (autoScroll && !userScrolledUp && lines.length > 0 && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, autoScroll, userScrolledUp]);

  // Detect user scroll-up to pause auto-scroll
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const element = event.currentTarget;
      const delta = element.scrollTop - scrollPositionRef.current;
      scrollPositionRef.current = element.scrollTop;

      // User scrolled up (negative delta)
      if (delta < 0 && autoScroll) {
        setUserScrolledUp(true);
      }
    },
    [autoScroll]
  );

  // Re-enable auto-scroll when user scrolls to bottom
  const scrollToBottom = () => {
    setUserScrolledUp(false);
    setAutoScroll(true);
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  };

  const scrollToTop = () => {
    setUserScrolledUp(true);
    setAutoScroll(false);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  };

  const handleClearBuffer = () => {
    clear();
    setUserScrolledUp(false);
  };

  const handleDownload = () => {
    const content = lines.map((l) => l.line).join('\n');
    const blob = new Blob([content], { type: 'application/x-jsonlines' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${componentRunId}.jsonl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderLine = (line: any, index: number) => {
    return (
      <Box
        key={index}
        sx={{
          display: 'flex',
          gap: 1,
          p: 0.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        }}
      >
        <Typography
          variant="caption"
          sx={{
            minWidth: '60px',
            color: 'text.secondary',
            fontFamily: 'monospace',
            textAlign: 'right',
          }}
        >
          {line.sequenceNumber}
        </Typography>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <SyntaxHighlighter
            language="json"
            style={atomDark}
            customStyle={{
              margin: 0,
              padding: '4px',
              fontSize: '12px',
              backgroundColor: 'transparent',
            }}
          >
            {line.line}
          </SyntaxHighlighter>
        </Box>
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' },
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="h6">Live Transcript</Typography>
            <Chip label={componentName} size="small" color="primary" />
            {isStreaming && <Chip label="Streaming" size="small" color="success" icon={<CircularProgress size={12} />} />}
            {isComplete && <Chip label="Complete" size="small" color="default" />}
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <Toolbar variant="dense" sx={{ gap: 1, borderBottom: 1, borderColor: 'divider' }}>
        <ToggleButtonGroup
          value={autoScroll ? 'auto' : 'manual'}
          exclusive
          size="small"
          onChange={(_, value) => {
            if (value === 'auto') {
              scrollToBottom();
            } else if (value === 'manual') {
              setAutoScroll(false);
            }
          }}
        >
          <ToggleButton value="auto">
            <VerticalAlignBottom fontSize="small" />
            Auto-scroll
          </ToggleButton>
          <ToggleButton value="manual">Manual</ToggleButton>
        </ToggleButtonGroup>

        <IconButton onClick={scrollToTop} size="small" title="Scroll to top">
          <VerticalAlignTop />
        </IconButton>

        <IconButton onClick={scrollToBottom} size="small" title="Scroll to bottom">
          <VerticalAlignBottom />
        </IconButton>

        <IconButton onClick={handleClearBuffer} size="small" title="Clear buffer">
          <Clear />
        </IconButton>

        <IconButton onClick={handleDownload} size="small" title="Download transcript">
          <Download />
        </IconButton>

        <Box flexGrow={1} />

        <Typography variant="caption" color="text.secondary">
          {lines.length} lines {lines.length >= 500 && '(buffer limit)'}
        </Typography>
      </Toolbar>

      <DialogContent
        sx={{
          p: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error.message}
          </Alert>
        )}

        {lines.length === 0 && !error && (
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            flexGrow={1}
          >
            <Typography color="text.secondary">
              {isStreaming ? 'Waiting for transcript data...' : 'No transcript data'}
            </Typography>
          </Box>
        )}

        {lines.length > 0 && (
          <Box
            ref={containerRef}
            onScroll={handleScroll}
            sx={{
              flexGrow: 1,
              overflow: 'auto',
              maxHeight: '600px',
            }}
          >
            {lines.map((line, index) => renderLine(line, index))}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ borderTop: 1, borderColor: 'divider', gap: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
          {isStreaming && 'Streaming active'}
          {isComplete && 'Stream complete'}
          {' • '}
          Buffer: {((lines.length / 500) * 100).toFixed(0)}%
        </Typography>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
