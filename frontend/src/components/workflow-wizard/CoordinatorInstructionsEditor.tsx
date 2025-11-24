import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  Typography,
  Paper,
  Chip,
  Stack,
  Alert,
  CircularProgress,
} from '@mui/material';
import { debounce } from 'lodash';
import { ComponentAssignment, TemplateValidationResult } from '../../types/workflow-wizard';
import { apiClient } from '../../services/api.client';

interface CoordinatorInstructionsEditorProps {
  instructions: string;
  onChange: (value: string) => void;
  componentAssignments: ComponentAssignment[];
}

export const CoordinatorInstructionsEditor: React.FC<CoordinatorInstructionsEditorProps> = ({
  instructions,
  onChange,
  componentAssignments,
}) => {
  const [validation, setValidation] = useState<TemplateValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Debounced validation function
  const validateTemplate = useCallback(
    debounce(async (text: string, assignments: ComponentAssignment[]) => {
      if (!text || assignments.length === 0) {
        setValidation(null);
        return;
      }

      setIsValidating(true);
      setValidationError(null);

      try {
        const response = await apiClient.post('/projects/validate-template', {
          instructions: text,
          componentAssignments: assignments,
        });

        setValidation(response.data);
      } catch (err: any) {
        setValidationError(err.message || 'Failed to validate template');
      } finally {
        setIsValidating(false);
      }
    }, 500),
    []
  );

  useEffect(() => {
    validateTemplate(instructions, componentAssignments);
  }, [instructions, componentAssignments, validateTemplate]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const getHighlightedText = (): JSX.Element[] => {
    if (!instructions) return [];

    const elements: JSX.Element[] = [];
    let lastIndex = 0;

    // Find all {{template}} references
    const regex = /\{\{([^}]+)\}\}/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(instructions)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        elements.push(
          <span key={`text-${lastIndex}`}>
            {instructions.substring(lastIndex, match.index)}
          </span>
        );
      }

      // Check if this reference is valid
      const refName = match[1].trim();
      const isValid = componentAssignments.some((ca) => ca.componentName === refName);

      // Add highlighted reference
      elements.push(
        <span
          key={`ref-${match.index}`}
          style={{
            backgroundColor: isValid ? '#c8e6c9' : '#ffcdd2',
            padding: '2px 4px',
            borderRadius: '3px',
            fontWeight: 'bold',
          }}
        >
          {match[0]}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < instructions.length) {
      elements.push(
        <span key={`text-${lastIndex}`}>
          {instructions.substring(lastIndex)}
        </span>
      );
    }

    return elements;
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" gutterBottom>
        Coordinator Instructions
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        Write instructions for the coordinator using component template syntax. Use double curly braces to reference components (e.g., {'{{'} Fullstack Developer {'}}'}).
      </Typography>

      {componentAssignments.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
            Available Components:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {componentAssignments.map((ca, index) => (
              <Chip
                key={index}
                label={ca.componentName}
                size="small"
                onClick={() => {
                  // Insert component reference at cursor position
                  const template = `{{${ca.componentName}}}`;
                  onChange(instructions + template);
                }}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Click a component name to insert it into the instructions
          </Typography>
        </Paper>
      )}

      <TextField
        value={instructions}
        onChange={handleChange}
        required
        fullWidth
        multiline
        rows={10}
        placeholder="Enter coordinator instructions here. Use {{Component Name}} to reference assigned components."
        InputProps={{
          sx: { fontFamily: 'monospace' },
        }}
      />

      {isValidating && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <CircularProgress size={16} />
          <Typography variant="caption">Validating template...</Typography>
        </Box>
      )}

      {validationError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {validationError}
        </Alert>
      )}

      {validation && !isValidating && (
        <Box sx={{ mt: 2 }} data-testid="template-validation">
          {validation.valid ? (
            <Alert severity="success">
              Template is valid! Found {validation.references.length} component reference(s).
            </Alert>
          ) : (
            <Alert severity="error">
              <Typography variant="subtitle2" gutterBottom>
                Template validation errors:
              </Typography>
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                {validation.errors.map((error, index) => (
                  <li key={index}>
                    <Typography variant="body2">
                      <strong>{error.reference}</strong>: {error.message}
                    </Typography>
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          {validation.references.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Template Preview (with highlighting):
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.8,
                }}
              >
                {getHighlightedText()}
              </Typography>
            </Paper>
          )}
        </Box>
      )}
    </Box>
  );
};
