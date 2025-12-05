/**
 * ArtifactViewerModal - View/Edit artifact content
 * ST-168: Artifact management UI
 */

import React, { useState, useEffect } from 'react';
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
  TextField,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Close,
  Edit,
  Visibility,
  Download,
  Save,
  ContentCopy,
  History,
} from '@mui/icons-material';
import { apiClient } from '../../services/api.client';

interface Artifact {
  id: string;
  definitionId?: string;
  definitionKey: string;
  definitionName: string;
  type: string;
  workflowRunId?: string;
  version: number;
  content: string | null;
  contentPreview: string | null;
  contentType?: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

interface ArtifactViewerModalProps {
  open: boolean;
  artifact: Artifact | null;
  mode: 'view' | 'edit';
  onClose: () => void;
  onModeChange: (mode: 'view' | 'edit') => void;
  onSave?: (content: string) => Promise<void>;
}

export const ArtifactViewerModal: React.FC<ArtifactViewerModalProps> = ({
  open,
  artifact,
  mode,
  onClose,
  onModeChange,
  onSave,
}) => {
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Reset state when artifact changes
  useEffect(() => {
    if (artifact) {
      const content = artifact.content || artifact.contentPreview || '';
      setEditedContent(content);
      setFullContent(artifact.content);
      setSaveError(null);
    }
  }, [artifact]);

  // Load full content if we only have preview
  useEffect(() => {
    if (open && artifact && !artifact.content && artifact.id) {
      setIsLoadingContent(true);
      const projectId = localStorage.getItem('selectedProjectId') ||
                        localStorage.getItem('currentProjectId');
      if (projectId) {
        // Use centralized API client (prevents double /api/api/ path)
        apiClient
          .get(`/api/projects/${projectId}/artifacts/${artifact.id}?includeContent=true`)
          .then((response) => {
            if (response.data.content) {
              setFullContent(response.data.content);
              setEditedContent(response.data.content);
            }
          })
          .catch(console.error)
          .finally(() => setIsLoadingContent(false));
      }
    }
  }, [open, artifact]);

  const handleCopy = async () => {
    const content = fullContent || editedContent;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!artifact) return;
    const content = fullContent || editedContent;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const ext = artifact.type === 'markdown' ? 'md' : artifact.type === 'json' ? 'json' : 'txt';
    link.download = `${artifact.definitionKey}_v${artifact.version}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(editedContent);
      onModeChange('view');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getTypeColor = (type: string): 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'default' => {
    switch (type) {
      case 'markdown': return 'primary';
      case 'code': return 'secondary';
      case 'json': return 'info';
      case 'report': return 'success';
      case 'image': return 'warning';
      default: return 'default';
    }
  };

  if (!artifact) return null;

  const displayContent = fullContent || editedContent || artifact.contentPreview || '';

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
              {artifact.definitionKey}
            </Typography>
            <Chip
              label={artifact.type}
              size="small"
              color={getTypeColor(artifact.type)}
            />
            <Chip
              label={`v${artifact.version}`}
              size="small"
              variant="outlined"
            />
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Tabs
              value={mode}
              onChange={(_, v) => onModeChange(v)}
              sx={{ minHeight: 36 }}
            >
              <Tab
                value="view"
                icon={<Visibility fontSize="small" />}
                iconPosition="start"
                label="View"
                sx={{ minHeight: 36, py: 0 }}
              />
              <Tab
                value="edit"
                icon={<Edit fontSize="small" />}
                iconPosition="start"
                label="Edit"
                sx={{ minHeight: 36, py: 0 }}
              />
            </Tabs>
            <IconButton onClick={onClose} size="small">
              <Close />
            </IconButton>
          </Box>
        </Box>
        <Box display="flex" gap={2} mt={1}>
          <Typography variant="caption" color="text.secondary">
            {artifact.definitionName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatSize(artifact.size)}
          </Typography>
          {artifact.createdBy && (
            <Typography variant="caption" color="text.secondary">
              by {artifact.createdBy}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            Updated: {formatDate(artifact.updatedAt)}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 0 }}>
        {saveError && (
          <Alert severity="error" sx={{ mx: 2, mt: 1 }}>
            {saveError}
          </Alert>
        )}

        {isLoadingContent ? (
          <Box display="flex" justifyContent="center" alignItems="center" flex={1}>
            <CircularProgress />
          </Box>
        ) : mode === 'view' ? (
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              bgcolor: 'background.paper',
              p: 2,
              m: 2,
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
            }}
          >
            <pre
              style={{
                margin: 0,
                fontFamily: 'Roboto, monospace',
                fontSize: '0.875rem',
                color: 'var(--fg)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {displayContent}
            </pre>
          </Box>
        ) : (
          <TextField
            multiline
            fullWidth
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            sx={{
              flex: 1,
              m: 2,
              '& .MuiInputBase-root': {
                height: '100%',
                alignItems: 'flex-start',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
              },
              '& .MuiInputBase-input': {
                height: '100% !important',
                overflow: 'auto !important',
              },
            }}
            InputProps={{
              sx: { height: '100%' },
            }}
          />
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
        <Button
          startIcon={<ContentCopy />}
          onClick={handleCopy}
          size="small"
        >
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        <Button
          startIcon={<Download />}
          onClick={handleDownload}
          size="small"
        >
          Download
        </Button>
        {artifact.version > 1 && (
          <Button
            startIcon={<History />}
            size="small"
            disabled
          >
            History
          </Button>
        )}
        <Box flex={1} />
        <Button onClick={onClose}>
          Close
        </Button>
        {mode === 'edit' && onSave && (
          <Button
            variant="contained"
            startIcon={isSaving ? <CircularProgress size={16} /> : <Save />}
            onClick={handleSave}
            disabled={isSaving}
          >
            Save
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ArtifactViewerModal;
