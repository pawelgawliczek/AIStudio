/**
 * ComponentOutputModal - Show component run output/results
 * ST-195: View component output when no transcript is available
 */

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
} from '@mui/material';
import React from 'react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { StructuredSummaryDisplay } from './StructuredSummaryDisplay';
import { ComponentSummaryStructured } from './types';

// Register JSON language
SyntaxHighlighter.registerLanguage('json', json);

interface ComponentOutputModalProps {
  open: boolean;
  onClose: () => void;
  componentName?: string;
  status?: string;
  output?: any;
  // ST-203: componentSummary is now structured
  componentSummary?: ComponentSummaryStructured | null;
  startedAt?: string;
  completedAt?: string;
}

export const ComponentOutputModal: React.FC<ComponentOutputModalProps> = ({
  open,
  onClose,
  componentName,
  status,
  output,
  componentSummary,
  startedAt,
  completedAt,
}) => {
  const getStatusColor = (s: string) => {
    switch (s) {
      case 'completed':
        return 'success';
      case 'running':
        return 'info';
      case 'failed':
        return 'error';
      case 'paused':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatDuration = (start?: string, end?: string) => {
    if (!start) return null;
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const seconds = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <span>📋</span>
          <Typography variant="h6">{componentName || 'Component'} Output</Typography>
          {status && (
            <Chip
              label={status.toUpperCase()}
              color={getStatusColor(status) as any}
              size="small"
              sx={{ ml: 'auto' }}
            />
          )}
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {/* Duration */}
        {startedAt && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              ⏱ Duration: {formatDuration(startedAt, completedAt)}
            </Typography>
          </Box>
        )}

        {/* Component Summary - ST-203: Use StructuredSummaryDisplay */}
        {componentSummary && (
          <Box
            sx={{
              mb: 3,
              p: 2,
              bgcolor: 'action.hover',
              borderRadius: 1,
              borderLeft: 3,
              borderLeftColor: 'primary.main',
            }}
          >
            <Typography variant="subtitle2" color="primary" gutterBottom>
              📝 Summary
            </Typography>
            <StructuredSummaryDisplay summary={componentSummary} variant="full" />
          </Box>
        )}

        {/* Output Data */}
        {output ? (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Output Data
            </Typography>
            <Box
              sx={{
                bgcolor: 'grey.900',
                borderRadius: 1,
                overflow: 'auto',
                maxHeight: '50vh',
              }}
            >
              <SyntaxHighlighter
                language="json"
                style={vs2015}
                customStyle={{
                  margin: 0,
                  fontSize: '0.8rem',
                  padding: '16px',
                  borderRadius: 4,
                }}
                wrapLines
                wrapLongLines
              >
                {JSON.stringify(output, null, 2)}
              </SyntaxHighlighter>
            </Box>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">No output data available</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
