/**
 * TranscriptViewerModal - View transcript with Parsed/Raw JSONL tabs
 * ST-173 Phase 7
 *
 * Security Requirements:
 * - Raw JSONL uses <pre> tag (not dangerouslySetInnerHTML)
 * - Download uses application/x-jsonlines MIME type
 * - Lazy loading for Raw JSONL tab
 * - Size warning for transcripts >1MB
 */

import {
  Close,
  Download,
  ContentCopy,
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
  Alert,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import React, { useState, useEffect } from 'react';
import { transcriptsService } from '../../services/transcripts.service';
import { TranscriptParser } from '../../utils/transcript-parser';
import type { ParsedTranscript } from '../../utils/transcript-parser';
import { TranscriptTurn } from './TranscriptTurn';

interface TranscriptViewerModalProps {
  open: boolean;
  transcriptId: string; // artifactId
  transcriptType: 'master' | 'agent';
  componentRunId?: string; // For agent transcripts
  runId: string;
  projectId: string;
  onClose: () => void;
}

export const TranscriptViewerModal: React.FC<TranscriptViewerModalProps> = ({
  open,
  transcriptId,
  transcriptType,
  componentRunId: _componentRunId,
  runId,
  projectId,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'parsed' | 'raw'>('parsed');
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [parsedTranscript, setParsedTranscript] = useState<ParsedTranscript | null>(null);
  const [componentName, setComponentName] = useState<string>('');
  const [transcriptSize, setTranscriptSize] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load transcript metadata on mount
  useEffect(() => {
    if (open && transcriptId) {
      loadTranscriptMetadata();
    }
  }, [open, transcriptId]);

  const loadTranscriptMetadata = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // ST-182: For agent transcripts, use getTranscriptByComponent (transcriptId is actually componentId)
      // For master transcripts, use getTranscript (transcriptId is artifactId)
      const detail = transcriptType === 'agent'
        ? await transcriptsService.getTranscriptByComponent(
            projectId,
            runId,
            transcriptId, // This is componentId for agent transcripts
            true // includeContent to get full transcript for parsing
          )
        : await transcriptsService.getTranscript(
            projectId,
            runId,
            transcriptId,
            true // includeContent to get full transcript for parsing
          );

      setComponentName(detail.componentName || 'Master Session');
      setTranscriptSize(detail.size);

      // Parse transcript for Parsed view
      if (detail.content) {
        const parser = new TranscriptParser();
        const parsed = parser.parseJSONL(detail.content);
        setParsedTranscript(parsed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transcript');
    } finally {
      setIsLoading(false);
    }
  };

  // Lazy load raw content when Raw JSONL tab is activated
  const handleTabChange = async (_event: React.SyntheticEvent, newTab: 'parsed' | 'raw') => {
    setActiveTab(newTab);

    if (newTab === 'raw' && !rawContent) {
      setIsLoading(true);
      setError(null);
      try {
        // ST-182: Use same logic as loadTranscriptMetadata
        const detail = transcriptType === 'agent'
          ? await transcriptsService.getTranscriptByComponent(
              projectId,
              runId,
              transcriptId,
              true // includeContent=true
            )
          : await transcriptsService.getTranscript(
              projectId,
              runId,
              transcriptId,
              true // includeContent=true
            );

        // 🔴 CRITICAL: Size warning for files >1MB
        if (detail.size > 1024 * 1024) {
          const sizeMB = (detail.size / (1024 * 1024)).toFixed(1);
          const confirmed = window.confirm(
            `Large transcript (${sizeMB} MB). Loading may take a moment. Continue?`
          );
          if (!confirmed) {
            setActiveTab('parsed');
            setIsLoading(false);
            return;
          }
        }

        setRawContent(detail.content || '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transcript');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCopy = async () => {
    const content = activeTab === 'raw' ? rawContent : formatParsedForCopy();
    if (content) {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const content = rawContent || '';
    if (!content) return;

    // 🔴 CRITICAL: Use application/x-jsonlines MIME type
    const blob = new Blob([content], { type: 'application/x-jsonlines' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcript-${transcriptId}.jsonl`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatParsedForCopy = (): string => {
    if (!parsedTranscript) return '';
    return parsedTranscript.turns
      .map((turn) => `[${turn.type}] ${turn.content}`)
      .join('\n\n');
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTokens = (count: number): string => {
    return count.toLocaleString('en-US');
  };

  const formatTokensShort = (count: number): string => {
    if (count < 1000) return count.toString();
    return `${Math.floor(count / 100) / 10}K`;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '80vh', display: 'flex', flexDirection: 'column' },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h6" component="span">
              TRANSCRIPT: {componentName}
            </Typography>
            <Chip
              label={transcriptType.toUpperCase()}
              size="small"
              color={transcriptType === 'master' ? 'primary' : 'secondary'}
              data-testid="transcript-type-badge"
            />
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              sx={{ minHeight: 36 }}
            >
              <Tab
                value="parsed"
                label="Parsed View"
                sx={{ minHeight: 36, py: 0 }}
              />
              <Tab
                value="raw"
                label="Raw JSONL"
                sx={{ minHeight: 36, py: 0 }}
              />
            </Tabs>
            <IconButton onClick={onClose} size="small">
              <Close />
            </IconButton>
          </Box>
        </Box>

        {/* Metadata row: Token metrics, size */}
        {parsedTranscript && (
          <Box display="flex" gap={2} mt={1}>
            <Typography variant="caption" color="text.secondary">
              📊 {formatTokens(parsedTranscript.metrics.totalTokens)} tokens
              ({formatTokensShort(parsedTranscript.metrics.inputTokens)} in,{' '}
              {formatTokensShort(parsedTranscript.metrics.outputTokens)} out)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatSize(transcriptSize)}
            </Typography>
          </Box>
        )}
      </DialogTitle>

      <DialogContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 0 }}>
        {error && (
          <Alert severity="error" sx={{ mx: 2, mt: 1 }}>
            Failed to load transcript: {error}
          </Alert>
        )}

        {isLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" flex={1}>
            <CircularProgress />
          </Box>
        ) : activeTab === 'parsed' ? (
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              p: 2,
            }}
          >
            {parsedTranscript ? (
              <>
                {parsedTranscript.turns.map((turn, index) => (
                  <TranscriptTurn key={index} turn={turn} />
                ))}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No transcript data available
              </Typography>
            )}
          </Box>
        ) : (
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              bgcolor: 'grey.900',
              p: 2,
              m: 2,
              borderRadius: 1,
            }}
          >
            {/* 🔴 CRITICAL: Use <pre> tag (not dangerouslySetInnerHTML) */}
            <pre
              data-testid="raw-jsonl-content"
              style={{
                margin: 0,
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                color: '#e0e0e0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {rawContent || 'Loading...'}
            </pre>
          </Box>
        )}

        {/* Warning message */}
        <Box sx={{ mx: 2, mb: 1 }}>
          <Alert severity="warning" sx={{ py: 0.5 }}>
            ⚠️ Transcripts may contain sensitive data
          </Alert>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
        <Button
          startIcon={<ContentCopy />}
          onClick={handleCopy}
          size="small"
        >
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        {activeTab === 'raw' && rawContent && (
          <Button
            startIcon={<Download />}
            onClick={handleDownload}
            size="small"
          >
            Download JSONL
          </Button>
        )}
        <Box flex={1} />
        <Button onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TranscriptViewerModal;
