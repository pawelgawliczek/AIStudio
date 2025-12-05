/**
 * ToolCallCard - Display tool invocation with collapsible JSON
 * ST-173 Phase 7
 */

import React, { useState } from 'react';
import { Box, Typography, IconButton, Collapse } from '@mui/material';
import { ExpandMore, Build } from '@mui/icons-material';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import type { ToolCall, ToolResult } from '../../utils/transcript-parser';

// Register JSON language
SyntaxHighlighter.registerLanguage('json', json);

// Override vs2015 theme to use only web-safe fonts (prevents fingerprinting warnings)
const customVs2015 = {
  ...vs2015,
  'hljs': {
    ...vs2015['hljs'],
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
  }
};

interface ToolCallCardProps {
  toolCall: ToolCall;
  result?: ToolResult;
  executionTime?: number;
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({
  toolCall,
  result,
  executionTime,
}) => {
  const [inputExpanded, setInputExpanded] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);

  // Generate preview text for input
  const getInputPreview = (): string => {
    const entries = Object.entries(toolCall.input || {});
    if (entries.length === 0) return '(empty)';

    const preview = entries
      .slice(0, 2)
      .map(([key, val]) => {
        const valStr = typeof val === 'string' ? val : JSON.stringify(val);
        // For file paths, show the full path (tests expect to find filename)
        const truncated = valStr.length > 100 ? valStr.slice(0, 100) + '...' : valStr;
        return `${key}: ${truncated}`;
      })
      .join(', ');

    return preview.length > 300 ? preview.slice(0, 300) + '...' : preview;
  };

  // Generate preview text for result
  const getResultPreview = (): string => {
    if (!result) return '';

    const output = result.output;
    if (!output) return '(empty)';

    if (typeof output === 'object' && output !== null) {
      const obj = output as Record<string, unknown>;
      if (obj.lines) return `File contents: ${obj.lines} lines`;
      if (obj.content) return `Content: ${String(obj.content).slice(0, 100)}...`;
      return JSON.stringify(output).slice(0, 100) + '...';
    }

    return String(output).slice(0, 100);
  };

  const handleInputToggle = () => {
    setInputExpanded(!inputExpanded);
  };

  const handleOutputToggle = () => {
    setOutputExpanded(!outputExpanded);
  };

  const handleKeyDown = (e: React.KeyboardEvent, handler: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler();
    }
  };

  return (
    <Box
      data-testid="tool-call-card"
      sx={{
        border: 1,
        borderColor: 'grey.300',
        borderRadius: 1,
        p: 2,
        mb: 1,
        bgcolor: 'background.paper',
      }}
    >
      {/* Tool name and icon */}
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <Build fontSize="small" data-testid="tool-icon" />
        <Typography variant="subtitle2" fontWeight="bold">
          {toolCall.name}
        </Typography>
        {executionTime !== undefined && (
          <Typography
            variant="caption"
            color="text.secondary"
            data-testid="execution-time"
            sx={{ ml: 'auto' }}
          >
            ⏱ {executionTime}s
          </Typography>
        )}
      </Box>

      {/* Input preview when collapsed */}
      {!inputExpanded && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mb: 1 }}
          data-testid="tool-input-preview"
        >
          {getInputPreview()}
        </Typography>
      )}

      {/* Collapsible Input section */}
      <Box
        data-testid="tool-input-section"
        role="button"
        aria-expanded={inputExpanded}
        tabIndex={0}
        onClick={handleInputToggle}
        onKeyDown={(e) => handleKeyDown(e, handleInputToggle)}
        sx={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 1,
          '&:focus': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 2,
          },
        }}
      >
        <IconButton
          size="small"
          sx={{
            transform: inputExpanded ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s',
          }}
        >
          <ExpandMore fontSize="small" />
        </IconButton>
        <Typography variant="body2" fontWeight="medium">
          Input
        </Typography>
      </Box>

      <Collapse in={inputExpanded} unmountOnExit>
        <Box
          sx={{
            bgcolor: 'grey.900',
            p: 2,
            borderRadius: 1,
            mb: 2,
            overflow: 'auto',
          }}
        >
          <SyntaxHighlighter
            language="json"
            style={customVs2015}
            customStyle={{
              margin: 0,
              fontSize: '0.75rem',
              borderRadius: 4,
              backgroundColor: '#1e1e1e',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            }}
            wrapLines={true}
            wrapLongLines={true}
            data-testid="tool-input-json"
          >
            {JSON.stringify(toolCall.input, null, 2)}
          </SyntaxHighlighter>
        </Box>
      </Collapse>

      {/* Output section (only if result exists) */}
      {result && (
        <>
          {/* Result preview when collapsed */}
          {!outputExpanded && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mb: 1 }}
            >
              &gt; {getResultPreview()}
            </Typography>
          )}

          {/* Collapsible Output section */}
          <Box
            data-testid="tool-output-section"
            role="button"
            aria-expanded={outputExpanded}
            tabIndex={0}
            onClick={handleOutputToggle}
            onKeyDown={(e) => handleKeyDown(e, handleOutputToggle)}
            sx={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 1,
              '&:focus': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: 2,
              },
            }}
          >
            <IconButton
              size="small"
              sx={{
                transform: outputExpanded ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s',
              }}
            >
              <ExpandMore fontSize="small" />
            </IconButton>
            <Typography variant="body2" fontWeight="medium">
              Output
            </Typography>
          </Box>

          <Collapse in={outputExpanded} unmountOnExit>
            <Box
              sx={{
                bgcolor: 'grey.900',
                p: 2,
                borderRadius: 1,
                overflow: 'auto',
              }}
            >
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: '#e0e0e0',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {JSON.stringify(result.output, null, 2)}
              </pre>
            </Box>
          </Collapse>
        </>
      )}
    </Box>
  );
};

export default ToolCallCard;
