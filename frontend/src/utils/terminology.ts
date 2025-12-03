/**
 * Terminology mapping utility for user-friendly display names
 *
 * This utility provides a single source of truth for translating technical
 * terminology to user-friendly names across the application.
 *
 * Design Decision (ST-109 Option A):
 * - Database schema remains technical (workflows, components)
 * - Internal code uses technical terms (easier for AI agents to understand)
 * - UI layer translates to user-friendly names via this utility
 *
 * Mapping (ST-164: Coordinators removed):
 * - Workflow → Team (a team of agents working together)
 * - Component → Agent (AI agents executing tasks)
 */

export const terminology = {
  // Singular forms (technical → user-friendly)
  workflow: 'Team',
  component: 'Agent',

  // User-friendly singular forms (for direct access)
  team: 'Team',
  agent: 'Agent',

  // Plural forms (technical → user-friendly)
  workflows: 'Teams',
  components: 'Agents',

  // User-friendly plural forms (for direct access)
  teams: 'Teams',
  agents: 'Agents',

  // Action verbs (Create/Edit/Delete patterns)
  createWorkflow: 'Create Team',
  editWorkflow: 'Edit Team',
  deleteWorkflow: 'Delete Team',
  createComponent: 'Create Agent',
  editComponent: 'Edit Agent',
  deleteComponent: 'Delete Agent',

  // Status messages
  workflowCreated: 'Team created successfully',
  workflowUpdated: 'Team updated successfully',
  workflowDeleted: 'Team deleted successfully',
  componentCreated: 'Agent created successfully',
  componentUpdated: 'Agent updated successfully',
  componentDeleted: 'Agent deleted successfully',

  // Descriptions
  workflowDescription: 'A team is a group of agents working together to accomplish a goal',
  componentDescription: 'An agent is an AI worker that executes specific tasks',
} as const;

/**
 * Type-safe helper function for terminology translation
 *
 * @param key - Terminology key to translate
 * @returns User-friendly display name
 *
 * @example
 * ```typescript
 * translate('workflow') // Returns: 'Team'
 * translate('workflows') // Returns: 'Teams'
 * translate('createComponent') // Returns: 'Create Agent'
 * ```
 */
export const translate = (key: keyof typeof terminology): string => {
  return terminology[key];
};

/**
 * Reverse mapping: User-friendly name → Technical term
 * Used for API calls and database queries where technical terms are required
 */
export const reverseTerminology: Record<string, string> = {
  'Team': 'workflow',
  'Teams': 'workflows',
  'Agent': 'component',
  'Agents': 'components',
};

/**
 * Helper to convert user-friendly term back to technical term
 *
 * @param displayName - User-friendly display name
 * @returns Technical term for internal use
 *
 * @example
 * ```typescript
 * toTechnical('Team') // Returns: 'workflow'
 * toTechnical('Agents') // Returns: 'components'
 * ```
 */
export const toTechnical = (displayName: string): string | undefined => {
  return reverseTerminology[displayName];
};
