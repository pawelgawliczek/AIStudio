import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import {
  Description,
  Code,
  Assessment,
  BugReport,
  Download,
  Visibility,
  InsertDriveFile,
} from '@mui/icons-material';

interface Artifact {
  s3Key: string;
  artifactType: string;
  filename: string;
  format: string;
  size: number;
  uploadedAt: string;
  downloadUrl?: string;
  data?: any;
}

interface ArtifactViewerProps {
  runId: string;
}

const ArtifactViewer: React.FC<ArtifactViewerProps> = ({ runId }) => {
  const [selectedArtifact, setSelectedArtifact] = React.useState<Artifact | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = React.useState(false);

  const { data, isLoading, error } = useQuery<{ artifacts: Artifact[]; total: number }>({
    queryKey: ['workflow-artifacts', runId],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/projects/${localStorage.getItem('currentProjectId')}/workflow-runs/${runId}/artifacts`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch artifacts');
      return response.json();
    },
  });

  const getArtifactIcon = (type: string) => {
    switch (type) {
      case 'code':
        return <Code />;
      case 'report':
        return <Description />;
      case 'test_results':
        return <BugReport />;
      case 'log':
        return <Assessment />;
      default:
        return <InsertDriveFile />;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleView = (artifact: Artifact) => {
    setSelectedArtifact(artifact);
    setViewDialogOpen(true);
  };

  const handleDownload = (artifact: Artifact) => {
    // Create blob and download
    const dataStr =
      typeof artifact.data === 'string' ? artifact.data : JSON.stringify(artifact.data, null, 2);
    const blob = new Blob([dataStr], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = artifact.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderArtifactContent = (artifact: Artifact) => {
    if (!artifact.data) {
      return (
        <Alert severity="info">
          Artifact data not available. Download URL: {artifact.downloadUrl || 'Pending'}
        </Alert>
      );
    }

    const dataStr =
      typeof artifact.data === 'string' ? artifact.data : JSON.stringify(artifact.data, null, 2);

    if (artifact.format === 'json' || artifact.format === 'code' || artifact.format === 'text') {
      return (
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            bgcolor: 'action.hover',
            maxHeight: '60vh',
            overflow: 'auto',
          }}
        >
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {dataStr}
          </pre>
        </Paper>
      );
    }

    return (
      <Alert severity="info">
        Preview not available for this format. Please download to view.
      </Alert>
    );
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load artifacts. Please try again.
      </Alert>
    );
  }

  if (!data || data.total === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="body1" color="text.secondary">
          No artifacts have been generated yet.
        </Typography>
        <Typography variant="body2" color="text.secondary" mt={1}>
          Artifacts will appear here as components complete their execution.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Artifacts</Typography>
        <Chip label={`${data.total} artifacts`} size="small" />
      </Box>

      <List>
        {data.artifacts.map((artifact, index) => (
          <ListItem
            key={artifact.s3Key}
            divider={index < data.artifacts.length - 1}
            secondaryAction={
              <Box display="flex" gap={1}>
                <IconButton
                  edge="end"
                  aria-label="view"
                  onClick={() => handleView(artifact)}
                  size="small"
                >
                  <Visibility />
                </IconButton>
                <IconButton
                  edge="end"
                  aria-label="download"
                  onClick={() => handleDownload(artifact)}
                  size="small"
                >
                  <Download />
                </IconButton>
              </Box>
            }
          >
            <ListItemIcon>{getArtifactIcon(artifact.artifactType)}</ListItemIcon>
            <ListItemText
              primary={
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body1">{artifact.filename}</Typography>
                  <Chip label={artifact.artifactType} size="small" variant="outlined" />
                </Box>
              }
              secondary={
                <Box>
                  <Typography variant="caption" component="span" color="text.secondary">
                    {formatSize(artifact.size)} • {artifact.format} •{' '}
                    {new Date(artifact.uploadedAt).toLocaleString()}
                  </Typography>
                </Box>
              }
            />
          </ListItem>
        ))}
      </List>

      {/* View Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedArtifact && (
          <>
            <DialogTitle>
              <Box display="flex" alignItems="center" gap={1}>
                {getArtifactIcon(selectedArtifact.artifactType)}
                <Typography variant="h6">{selectedArtifact.filename}</Typography>
              </Box>
            </DialogTitle>
            <DialogContent>
              {renderArtifactContent(selectedArtifact)}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => handleDownload(selectedArtifact)} startIcon={<Download />}>
                Download
              </Button>
              <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default ArtifactViewer;
