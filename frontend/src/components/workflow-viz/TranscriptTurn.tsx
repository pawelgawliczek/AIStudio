/**
 * TranscriptTurn - Display individual conversation turn
 * ST-173 Phase 7
 */

import React, { useState } from 'react';
import { Box, Typography, IconButton, Collapse } from '@mui/material';
import { Person, SmartToy, Settings, ExpandMore } from '@mui/icons-material';
import type { ConversationTurn } from '../../utils/transcript-parser';
import { ToolCallCard } from './ToolCallCard';

interface TranscriptTurnProps {
  turn: ConversationTurn;
}

export const TranscriptTurn: React.FC<TranscriptTurnProps> = ({ turn }) => {
  const [toolCallsExpanded, setToolCallsExpanded] = useState(false);

  // Get background color based on turn type
  const getBackgroundColor = (): string => {
    switch (turn.type) {
      case 'user':
        return 'bg-blue-500/10';
      case 'assistant':
        return 'bg-gray-500/10';
      case 'system':
        return 'bg-yellow-500/10';
      default:
        return 'bg-gray-500/10';
    }
  };

  // Get icon based on turn type
  const getTurnIcon = () => {
    switch (turn.type) {
      case 'user':
        return <Person fontSize="small" data-testid="turn-icon-user" />;
      case 'assistant':
        return <SmartToy fontSize="small" data-testid="turn-icon-assistant" />;
      case 'system':
        return <Settings fontSize="small" data-testid="turn-icon-system" />;
      default:
        return null;
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  // Format token count with separators
  const formatTokens = (count: number): string => {
    return count.toLocaleString('en-US');
  };

  // Format token count in K notation (truncate, not round)
  const formatTokensShort = (count: number): string => {
    if (count < 1000) return count.toString();
    return `${Math.floor(count / 100) / 10}K`;
  };

  // Calculate total tokens
  const totalTokens = (turn.usage?.inputTokens || 0) + (turn.usage?.outputTokens || 0);

  return (
    <Box
      data-testid="transcript-turn"
      className={`${getBackgroundColor()} rounded-lg p-4 mb-3`}
    >
      {/* Header: Icon, Type, Timestamp */}
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        {getTurnIcon()}
        <Typography variant="subtitle2" fontWeight="bold" sx={{ textTransform: 'capitalize' }}>
          {turn.type}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          data-testid="turn-timestamp"
          sx={{ ml: 'auto' }}
        >
          {formatTimestamp(turn.timestamp)}
        </Typography>
      </Box>

      {/* Content */}
      {turn.content && (
        <Typography
          variant="body2"
          data-testid="turn-content"
          sx={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            mb: 2,
          }}
        >
          {turn.content}
        </Typography>
      )}

      {/* Tool Calls Section */}
      {turn.toolCalls && turn.toolCalls.length > 0 && (
        <Box mt={2}>
          <Box
            display="flex"
            alignItems="center"
            gap={1}
            onClick={() => setToolCallsExpanded(!toolCallsExpanded)}
            sx={{
              cursor: 'pointer',
              mb: 1,
              '&:hover': {
                opacity: 0.8,
              },
            }}
          >
            <IconButton
              size="small"
              sx={{
                transform: toolCallsExpanded ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s',
              }}
            >
              <ExpandMore fontSize="small" />
            </IconButton>
            <Typography variant="body2" fontWeight="medium">
              Tool Calls ({turn.toolCalls.length})
            </Typography>
          </Box>

          {/* Show tool names preview when collapsed */}
          {!toolCallsExpanded && (
            <Box pl={4} mb={1}>
              <Typography variant="caption" color="text.secondary">
                {turn.toolCalls.map((tc) => tc.name).join(', ')}
              </Typography>
            </Box>
          )}

          <Collapse in={toolCallsExpanded} unmountOnExit>
            <Box pl={4}>
              {turn.toolCalls.map((toolCall, index) => {
                // Find matching result
                const result = turn.toolResults?.find((r) => r.name === toolCall.name);
                return (
                  <ToolCallCard
                    key={index}
                    toolCall={toolCall}
                    result={result}
                  />
                );
              })}
            </Box>
          </Collapse>
        </Box>
      )}

      {/* Token Metrics */}
      {turn.usage && totalTokens > 0 && (
        <Box
          display="flex"
          gap={2}
          mt={2}
          pt={2}
          borderTop={1}
          borderColor="grey.300"
        >
          <Typography variant="caption" color="text.secondary">
            📊 {formatTokens(totalTokens)} tokens
            ({formatTokensShort(turn.usage.inputTokens || 0)} in,{' '}
            {formatTokensShort(turn.usage.outputTokens || 0)} out)
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default TranscriptTurn;
