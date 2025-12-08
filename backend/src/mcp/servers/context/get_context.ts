/**
 * Get Context Tool
 * Retrieve current session context
 *
 * ST-187: MCP Tool Optimization & Step Commands
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { getContext, formatContext, clearContext } from '../../shared/session-context';

export const tool: Tool = {
  name: 'get_context',
  description: `Retrieve current session context.

Shows all context values that will be automatically applied to subsequent tool calls.

**Returns:**
- \`projectId\` / \`projectName\` - Active project
- \`teamId\` / \`teamName\` - Active team/workflow
- \`storyId\` / \`storyKey\` - Active story
- \`runId\` - Active workflow run
- \`model\` - Default model

**Example:**
\`\`\`typescript
get_context()
// Returns: { projectId: "...", projectName: "AI Studio", ... }
\`\`\``,
  inputSchema: {
    type: 'object',
    properties: {
      clear: {
        type: 'boolean',
        description: 'Clear the context after returning it (default: false)',
      },
    },
  },
};

export const metadata = {
  category: 'context',
  domain: 'Session Context',
  tags: ['context', 'session', 'configuration'],
  version: '1.0.0',
  since: '2025-12-08',
};

export async function handler(
  _prisma: PrismaClient,
  params: {
    clear?: boolean;
  }
) {
  const context = getContext();
  const summary = formatContext(context);
  const hasContext = Object.keys(context).length > 0;

  // Optionally clear context
  if (params.clear) {
    clearContext();
  }

  return {
    success: true,
    hasContext,
    context,
    summary,
    cleared: params.clear || false,
    message: hasContext ? `Current context: ${summary}` : 'No context set. Use set_context to set project, team, etc.',
    hint: hasContext
      ? 'These values are automatically applied to tool calls when not explicitly provided.'
      : 'Use set_context({ project: "AI Studio" }) to set context values.',
  };
}
