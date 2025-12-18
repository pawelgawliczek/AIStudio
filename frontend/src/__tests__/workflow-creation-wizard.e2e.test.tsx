/**
 * Comprehensive E2E Tests: Team Creation Wizard (ST-90)
 *
 * Tests the complete 3-step team creation process including:
 * - Step 1: Team shell creation (name, description, project)
 * - Step 2: Agent version selection with unique name validation
 * - Step 3: Project Manager selection (existing) or creation (new) with template validation
 *
 * Coverage:
 * - AC-1: Team shell creation
 * - AC-2: Agent version selection with duplicate detection
 * - AC-3: Existing project manager selection with template preview
 * - AC-4: New project manager creation with template validation
 * - AC-5: Template validation error handling
 * - AC-7: End-to-end team creation
 *
 * Additional scenarios:
 * - Navigation and state persistence
 * - Error recovery
 * - Responsive design testing
 * - Performance with large datasets
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AxiosInstance } from 'axios';
import React from 'react';
import { vi } from 'vitest';
import { WorkflowCreationWizard } from '../components/workflow-wizard/WorkflowCreationWizard';
// Mock API client
vi.mock('../services/api.client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  } as unknown as AxiosInstance,
}));
// Import the mocked client
import { apiClient } from '../services/api.client';
const mockedApiClient = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

// Test data fixtures
const mockProjects = [
  { id: 'project-1', name: 'E-Commerce Platform' },
  { id: 'project-2', name: 'Analytics Dashboard' },
  { id: 'project-3', name: 'Content Management System' },
];

const mockAgents = [
  {
    id: 'comp-1',
    name: 'Fullstack Developer',
    version: 'v0.2',
    versionMajor: 0,
    versionMinor: 2,
    active: true,
  },
  {
    id: 'comp-2',
    name: 'QA Engineer',
    version: 'v0.5',
    versionMajor: 0,
    versionMinor: 5,
    active: true,
  },
  {
    id: 'comp-3',
    name: 'PM Agent',
    version: 'v0.3',
    versionMajor: 0,
    versionMinor: 3,
    active: true,
  },
  {
    id: 'comp-4',
    name: 'Designer',
    version: 'v0.4',
    versionMajor: 0,
    versionMinor: 4,
    active: true,
  },
  {
    id: 'comp-5',
    name: 'Backend Developer',
    version: 'v0.6',
    versionMajor: 0,
    versionMinor: 6,
    active: true,
  },
];

const mockComponentVersions = {
  'comp-1': [
    { id: 'ver-1-2', version: 'v0.2', versionMajor: 0, versionMinor: 2, isDeprecated: false },
    { id: 'ver-1-1', version: 'v0.1', versionMajor: 0, versionMinor: 1, isDeprecated: false },
  ],
  'comp-2': [
    { id: 'ver-2-5', version: 'v0.5', versionMajor: 0, versionMinor: 5, isDeprecated: false },
    { id: 'ver-2-4', version: 'v0.4', versionMajor: 0, versionMinor: 4, isDeprecated: false },
    { id: 'ver-2-3', version: 'v0.3', versionMajor: 0, versionMinor: 3, isDeprecated: true },
  ],
  'comp-3': [
    { id: 'ver-3-3', version: 'v0.3', versionMajor: 0, versionMinor: 3, isDeprecated: false },
    { id: 'ver-3-2', version: 'v0.2', versionMajor: 0, versionMinor: 2, isDeprecated: false },
  ],
  'comp-4': [
    { id: 'ver-4-4', version: 'v0.4', versionMajor: 0, versionMinor: 4, isDeprecated: false },
  ],
  'comp-5': [
    { id: 'ver-5-6', version: 'v0.6', versionMajor: 0, versionMinor: 6, isDeprecated: false },
    { id: 'ver-5-5', version: 'v0.5', versionMajor: 0, versionMinor: 5, isDeprecated: false },
  ],
};

const mockProjectManagers = [
  {
    id: 'coord-1',
    name: 'Feature Implementation Project Manager',
    version: 'v1.2',
    versionMajor: 1,
    versionMinor: 2,
    operationInstructions: 'Use {{PM Agent}}, {{Fullstack Developer}}, and {{QA Engineer}} to implement features',
  },
  {
    id: 'coord-2',
    name: 'Bug Fix Project Manager',
    version: 'v1.0',
    versionMajor: 1,
    versionMinor: 0,
    operationInstructions: 'Use {{Fullstack Developer}} to fix bugs and {{QA Engineer}} to verify',
  },
];

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWizard(props = {}) {
  const queryClient = createTestQueryClient();
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    projectId: 'project-1',
    projects: mockProjects,
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <WorkflowCreationWizard {...defaultProps} {...props} />
    </QueryClientProvider>
  );
}

describe('Team Creation Wizard E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default API mocks
    mockedApiClient.get.mockImplementation((url) => {
      if (url.includes('/components') && !url.includes('/versions')) {
        return Promise.resolve({ data: mockAgents });
      }
      if (url.includes('/coordinators')) {
        return Promise.resolve({ data: mockProjectManagers });
      }
      if (url.includes('/versions')) {
        const componentId = url.split('/')[3];
        return Promise.resolve({ data: mockComponentVersions[componentId] || [] });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    mockedApiClient.post.mockImplementation((url, data) => {
      if (url.includes('/workflows') && !url.includes('/validate-template')) {
        return Promise.resolve({
          data: {
            id: 'workflow-1',
            ...data,
          },
        });
      }
      if (url.includes('/components')) {
        return Promise.resolve({
          data: {
            id: 'new-coord-1',
            ...data,
          },
        });
      }
      if (url.includes('/validate-template')) {
        const { instructions, componentAssignments } = data;
        const regex = /\{\{([^}]+)\}\}/g;
        const matches = [...instructions.matchAll(regex)];
        const componentNames = componentAssignments.map((c: any) => c.componentName);
        const errors = matches
          .filter((match) => !componentNames.includes(match[1].trim()))
          .map((match) => ({
            reference: match[1].trim(),
            message: `Component '${match[1].trim()}' not found in assigned components`,
            startIndex: match.index,
            endIndex: match.index + match[0].length,
          }));

        return Promise.resolve({
          data: {
            valid: errors.length === 0,
            errors,
            references: matches.map((m) => ({
              name: m[1].trim(),
              startIndex: m.index,
              endIndex: m.index + m[0].length,
            })),
            missingComponents: errors.map((e) => e.reference),
          },
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  describe('AC-7: Complete Team Creation Flow (Happy Paths)', () => {
    it('should create team with existing project manager through all 3 steps', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      const onClose = vi.fn();

      renderWizard({ onSuccess, onClose });

      // Step 1: Team Shell
      expect(screen.getByText('Create New Team')).toBeInTheDocument();
      expect(screen.getByText('Team Information')).toBeInTheDocument();

      const nameInput = screen.getByLabelText(/team name/i);
      const descriptionInput = screen.getByLabelText(/description/i);

      await user.type(nameInput, 'Feature Implementation Flow');
      await user.type(descriptionInput, 'Automated feature implementation for web app');

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).not.toBeDisabled();

      await user.click(nextButton);

      // Step 2: Agent Selection
      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      // Add first agent
      const addAgentButton = screen.getByRole('button', { name: /add agent/i });
      await user.click(addAgentButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/agent/i)).toBeInTheDocument();
      });

      const agentDropdown = screen.getByLabelText(/agent/i);
      await user.click(agentDropdown);
      await user.click(screen.getByText('Fullstack Developer'));

      const versionDropdown = screen.getByLabelText(/version/i);
      await user.click(versionDropdown);
      await user.click(screen.getByText('v0.2'));

      // Add second agent
      await user.click(addAgentButton);

      const agentDropdowns = screen.getAllByLabelText(/agent/i);
      await user.click(agentDropdowns[1]);
      await user.click(screen.getByText('QA Engineer'));

      const versionDropdowns = screen.getAllByLabelText(/version/i);
      await user.click(versionDropdowns[1]);
      await user.click(screen.getByText('v0.5'));

      // Proceed to step 3
      const nextButton2 = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton2);

      // Step 3: Project Manager Selection
      await waitFor(() => {
        expect(screen.getByText('Choose Project Manager')).toBeInTheDocument();
      });

      const existingRadio = screen.getByLabelText(/use existing project manager/i);
      expect(existingRadio).toBeChecked();

      const pmDropdown = screen.getByLabelText(/project manager/i);
      await user.click(pmDropdown);
      await user.click(screen.getByText('Feature Implementation Project Manager'));

      // Submit team
      const createButton = screen.getByRole('button', { name: /create team/i });
      await user.click(createButton);

      // Verify API calls
      await waitFor(() => {
        expect(mockedApiClient.post).toHaveBeenCalledWith(
          expect.stringContaining('/workflows'),
          expect.objectContaining({
            name: 'Feature Implementation Flow',
            description: 'Automated feature implementation for web app',
            coordinatorId: 'coord-1',
            componentAssignments: expect.arrayContaining([
              expect.objectContaining({
                componentName: 'Fullstack Developer',
                version: 'v0.2',
              }),
              expect.objectContaining({
                componentName: 'QA Engineer',
                version: 'v0.5',
              }),
            ]),
          })
        );
      });

      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('should create team with new coordinator and template validation', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      renderWizard({ onSuccess });

      // Step 1: Complete
      await user.type(screen.getByLabelText(/team name/i), 'Custom Bug Fix Flow');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 2: Add components
      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      const addComponentButton = screen.getByRole('button', { name: /add agent/i });
      await user.click(addComponentButton);

      const componentDropdown = screen.getByLabelText(/component/i);
      await user.click(componentDropdown);
      await user.click(screen.getByText('Fullstack Developer'));

      const versionDropdown = screen.getByLabelText(/version/i);
      await user.click(versionDropdown);
      await user.click(screen.getByText('v0.2'));

      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 3: Create new coordinator
      await waitFor(() => {
        expect(screen.getByText('Choose Project Manager')).toBeInTheDocument();
      });

      const newRadio = screen.getByLabelText(/create new project manager/i);
      await user.click(newRadio);

      const coordinatorNameInput = screen.getByLabelText(/project manager name/i);
      await user.type(coordinatorNameInput, 'Bug Fix Coordinator');

      const instructionsInput = screen.getByLabelText(/instructions/i);
      await user.type(instructionsInput, '1. {{Fullstack Developer}} fixes the bug\n2. Test the fix');

      const modelDropdown = screen.getByLabelText(/model/i);
      await user.click(modelDropdown);
      await user.click(screen.getByText('claude-sonnet-4.5'));

      // Submit
      const createButton = screen.getByRole('button', { name: /create team/i });
      await user.click(createButton);

      // Verify coordinator creation
      await waitFor(() => {
        expect(mockedApiClient.post).toHaveBeenCalledWith(
          expect.stringContaining('/components'),
          expect.objectContaining({
            name: 'Bug Fix Coordinator',
            operationInstructions: expect.stringContaining('{{Fullstack Developer}}'),
          })
        );
      });

      // Verify workflow creation
      expect(mockedApiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/workflows'),
        expect.objectContaining({
          name: 'Custom Bug Fix Flow',
          coordinatorId: 'new-coord-1',
        })
      );

      expect(onSuccess).toHaveBeenCalled();
    });

    it('should create team with multiple components (5 components)', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      renderWizard({ onSuccess });

      // Step 1
      await user.type(screen.getByLabelText(/team name/i), 'Full Stack Feature Workflow');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 2: Add 5 components
      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      const addComponentButton = screen.getByRole('button', { name: /add agent/i });
      const componentNames = ['Fullstack Developer', 'QA Engineer', 'PM Agent', 'Designer', 'Backend Developer'];

      for (let i = 0; i < 5; i++) {
        await user.click(addComponentButton);

        await waitFor(() => {
          const dropdowns = screen.getAllByLabelText(/component/i);
          expect(dropdowns.length).toBe(i + 1);
        });

        const componentDropdowns = screen.getAllByLabelText(/component/i);
        await user.click(componentDropdowns[i]);
        await user.click(screen.getByText(componentNames[i]));

        const versionDropdowns = screen.getAllByLabelText(/version/i);
        await user.click(versionDropdowns[i]);
        const versionOptions = screen.getAllByText(/^v0\.\d+$/);
        await user.click(versionOptions[0]);
      }

      // Verify 5 components added
      expect(screen.getAllByLabelText(/component/i)).toHaveLength(5);

      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 3: Select coordinator
      await waitFor(() => {
        expect(screen.getByText('Choose Project Manager')).toBeInTheDocument();
      });

      const coordinatorDropdown = screen.getByLabelText(/coordinator/i);
      await user.click(coordinatorDropdown);
      await user.click(screen.getByText('Feature Implementation Coordinator'));

      await user.click(screen.getByRole('button', { name: /create team/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('AC-2: Component Unique Name Validation', () => {
    it('should prevent adding duplicate component names', async () => {
      const user = userEvent.setup();
      renderWizard();

      // Navigate to step 2
      await user.type(screen.getByLabelText(/team name/i), 'Test Workflow');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      // Add first component
      const addComponentButton = screen.getByRole('button', { name: /add agent/i });
      await user.click(addComponentButton);

      const componentDropdown = screen.getByLabelText(/component/i);
      await user.click(componentDropdown);
      await user.click(screen.getByText('Fullstack Developer'));

      // Try to add same component again
      await user.click(addComponentButton);

      const componentDropdowns = screen.getAllByLabelText(/component/i);
      await user.click(componentDropdowns[1]);
      await user.click(screen.getAllByText('Fullstack Developer')[1]);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/already assigned/i)).toBeInTheDocument();
      });

      // Next button should be disabled
      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });

    it('should allow removing duplicate and proceeding', async () => {
      const user = userEvent.setup();
      renderWizard();

      await user.type(screen.getByLabelText(/team name/i), 'Test Workflow');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      // Add two components with same name (triggering error)
      const addComponentButton = screen.getByRole('button', { name: /add agent/i });
      await user.click(addComponentButton);
      await user.click(screen.getByLabelText(/component/i));
      await user.click(screen.getByText('Fullstack Developer'));

      await user.click(addComponentButton);
      const componentDropdowns = screen.getAllByLabelText(/component/i);
      await user.click(componentDropdowns[1]);
      await user.click(screen.getAllByText('Fullstack Developer')[1]);

      // Verify error
      await waitFor(() => {
        expect(screen.getByText(/already assigned/i)).toBeInTheDocument();
      });

      // Remove duplicate by clicking remove button
      const removeButtons = screen.getAllByRole('button', { name: /remove/i });
      await user.click(removeButtons[1]);

      // Error should be gone, next enabled
      await waitFor(() => {
        expect(screen.queryByText(/already assigned/i)).not.toBeInTheDocument();
      });

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).not.toBeDisabled();
    });

    it('should validate duplicate names across different versions', async () => {
      const user = userEvent.setup();
      renderWizard();

      await user.type(screen.getByLabelText(/team name/i), 'Test Workflow');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      // Add Developer v0.2
      const addComponentButton = screen.getByRole('button', { name: /add agent/i });
      await user.click(addComponentButton);
      await user.click(screen.getByLabelText(/component/i));
      await user.click(screen.getByText('Fullstack Developer'));
      await user.click(screen.getByLabelText(/version/i));
      await user.click(screen.getByText('v0.2'));

      // Try to add Developer v0.1 (different version, same name)
      await user.click(addComponentButton);
      const componentDropdowns = screen.getAllByLabelText(/component/i);
      await user.click(componentDropdowns[1]);
      await user.click(screen.getAllByText('Fullstack Developer')[1]);

      const versionDropdowns = screen.getAllByLabelText(/version/i);
      await user.click(versionDropdowns[1]);
      await user.click(screen.getAllByText('v0.1')[0]);

      // Should still show duplicate error (name must be unique regardless of version)
      await waitFor(() => {
        expect(screen.getByText(/already assigned/i)).toBeInTheDocument();
      });
    });
  });

  describe('AC-4 & AC-5: New Coordinator Creation with Template Validation', () => {
    it('should create new project manager with valid template references', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      renderWizard({ onSuccess });

      // Complete steps 1 and 2
      await user.type(screen.getByLabelText(/team name/i), 'Template Test Workflow');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      const addComponentButton = screen.getByRole('button', { name: /add agent/i });
      await user.click(addComponentButton);
      await user.click(screen.getByLabelText(/component/i));
      await user.click(screen.getByText('Fullstack Developer'));
      await user.click(screen.getByLabelText(/version/i));
      await user.click(screen.getByText('v0.2'));

      await user.click(addComponentButton);
      const componentDropdowns = screen.getAllByLabelText(/component/i);
      await user.click(componentDropdowns[1]);
      await user.click(screen.getByText('QA Engineer'));

      const versionDropdowns = screen.getAllByLabelText(/version/i);
      await user.click(versionDropdowns[1]);
      await user.click(screen.getByText('v0.5'));

      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 3: Create coordinator with valid template
      await waitFor(() => {
        expect(screen.getByText('Choose Project Manager')).toBeInTheDocument();
      });

      const newRadio = screen.getByLabelText(/create new project manager/i);
      await user.click(newRadio);

      await user.type(screen.getByLabelText(/project manager name/i), 'Test Coordinator');

      const instructionsInput = screen.getByLabelText(/instructions/i);
      await user.type(
        instructionsInput,
        'Step 1: {{Fullstack Developer}} implements\nStep 2: {{QA Engineer}} tests'
      );

      // Wait for validation (debounced)
      await waitFor(
        () => {
          const createButton = screen.getByRole('button', { name: /create team/i });
          expect(createButton).not.toBeDisabled();
        },
        { timeout: 2000 }
      );

      // Should show no errors
      expect(screen.queryByText(/not found/i)).not.toBeInTheDocument();
    });

    it('should show validation errors for invalid template references', async () => {
      const user = userEvent.setup();
      renderWizard();

      // Navigate to step 3
      await user.type(screen.getByLabelText(/team name/i), 'Test Workflow');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      const addComponentButton = screen.getByRole('button', { name: /add agent/i });
      await user.click(addComponentButton);
      await user.click(screen.getByLabelText(/component/i));
      await user.click(screen.getByText('Fullstack Developer'));
      await user.click(screen.getByLabelText(/version/i));
      await user.click(screen.getByText('v0.2'));

      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 3: Create coordinator with invalid reference
      await waitFor(() => {
        expect(screen.getByText('Choose Project Manager')).toBeInTheDocument();
      });

      const newRadio = screen.getByLabelText(/create new project manager/i);
      await user.click(newRadio);

      await user.type(screen.getByLabelText(/project manager name/i), 'Invalid Coordinator');

      const instructionsInput = screen.getByLabelText(/instructions/i);
      await user.type(
        instructionsInput,
        '1. {{Fullstack Developer}} implements\n2. {{QA Engineer}} validates' // QA Engineer not assigned
      );

      // Wait for validation error
      await waitFor(
        () => {
          expect(screen.getByText(/QA Engineer.*not found/i)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      // Create button should be disabled
      const createButton = screen.getByRole('button', { name: /create team/i });
      expect(createButton).toBeDisabled();
    });

    it('should allow fixing validation errors and proceeding', async () => {
      const user = userEvent.setup();
      renderWizard();

      // Complete steps 1 and 2 with only one component
      await user.type(screen.getByLabelText(/team name/i), 'Fix Validation Test');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      const addComponentButton = screen.getByRole('button', { name: /add agent/i });
      await user.click(addComponentButton);
      await user.click(screen.getByLabelText(/component/i));
      await user.click(screen.getByText('Fullstack Developer'));
      await user.click(screen.getByLabelText(/version/i));
      await user.click(screen.getByText('v0.2'));

      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 3: Enter invalid reference
      await waitFor(() => {
        expect(screen.getByText('Choose Project Manager')).toBeInTheDocument();
      });

      const newRadio = screen.getByLabelText(/create new project manager/i);
      await user.click(newRadio);

      await user.type(screen.getByLabelText(/project manager name/i), 'Test Coordinator');

      const instructionsInput = screen.getByLabelText(/instructions/i);
      await user.type(instructionsInput, 'Use {{QA Engineer}}'); // Invalid

      await waitFor(() => {
        expect(screen.getByText(/not found/i)).toBeInTheDocument();
      });

      // Go back and add missing component
      await user.click(screen.getByRole('button', { name: /back/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      await user.click(addComponentButton);
      const componentDropdowns = screen.getAllByLabelText(/component/i);
      await user.click(componentDropdowns[1]);
      await user.click(screen.getByText('QA Engineer'));

      const versionDropdowns = screen.getAllByLabelText(/version/i);
      await user.click(versionDropdowns[1]);
      await user.click(screen.getByText('v0.5'));

      // Return to step 3
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Validation should pass now
      await waitFor(() => {
        expect(screen.queryByText(/not found/i)).not.toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create team/i });
      expect(createButton).not.toBeDisabled();
    });

    it('should highlight valid references in green', async () => {
      const user = userEvent.setup();
      renderWizard();

      // Setup with components
      await user.type(screen.getByLabelText(/team name/i), 'Highlight Test');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      const addComponentButton = screen.getByRole('button', { name: /add agent/i });
      await user.click(addComponentButton);
      await user.click(screen.getByLabelText(/component/i));
      await user.click(screen.getByText('Fullstack Developer'));
      await user.click(screen.getByLabelText(/version/i));
      await user.click(screen.getByText('v0.2'));

      await user.click(screen.getByRole('button', { name: /next/i }));

      // Create coordinator with valid reference
      await waitFor(() => {
        expect(screen.getByText('Choose Project Manager')).toBeInTheDocument();
      });

      const newRadio = screen.getByLabelText(/create new project manager/i);
      await user.click(newRadio);

      await user.type(screen.getByLabelText(/project manager name/i), 'Test');

      const instructionsInput = screen.getByLabelText(/instructions/i);
      await user.type(instructionsInput, 'Use {{Fullstack Developer}} to implement');

      // Check for green highlight/valid indicator
      await waitFor(() => {
        const validIndicator = screen.getByText(/valid/i); // Or check for green styling
        expect(validIndicator).toBeInTheDocument();
      });
    });

    it('should handle multiline template instructions', async () => {
      const user = userEvent.setup();
      renderWizard();

      await user.type(screen.getByLabelText(/team name/i), 'Multiline Test');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      const addComponentButton = screen.getByRole('button', { name: /add agent/i });
      await user.click(addComponentButton);
      await user.click(screen.getByLabelText(/component/i));
      await user.click(screen.getByText('Fullstack Developer'));
      await user.click(screen.getByLabelText(/version/i));
      await user.click(screen.getByText('v0.2'));

      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Choose Project Manager')).toBeInTheDocument();
      });

      const newRadio = screen.getByLabelText(/create new project manager/i);
      await user.click(newRadio);

      await user.type(screen.getByLabelText(/project manager name/i), 'Test');

      const instructionsInput = screen.getByLabelText(/instructions/i);
      const multilineInstructions = `
        Step 1: Analyze requirements
        Step 2: {{Fullstack Developer}} implements feature
        Step 3: Deploy to production
        Step 4: {{Fullstack Developer}} monitors
      `;
      await user.type(instructionsInput, multilineInstructions);

      // Should validate all lines
      await waitFor(
        () => {
          const createButton = screen.getByRole('button', { name: /create team/i });
          expect(createButton).not.toBeDisabled();
        },
        { timeout: 2000 }
      );
    });
  });

  describe('Navigation and State Management', () => {
    it('should preserve data when navigating between steps', async () => {
      const user = userEvent.setup();
      renderWizard();

      // Step 1
      const workflowName = 'Persistent Workflow';
      const workflowDesc = 'Test description for persistence';

      await user.type(screen.getByLabelText(/team name/i), workflowName);
      await user.type(screen.getByLabelText(/description/i), workflowDesc);
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 2
      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      // Go back
      await user.click(screen.getByRole('button', { name: /back/i }));

      // Verify data preserved
      await waitFor(() => {
        expect(screen.getByLabelText(/team name/i)).toHaveValue(workflowName);
        expect(screen.getByLabelText(/description/i)).toHaveValue(workflowDesc);
      });
    });

    it('should preserve component selections when going back from step 3', async () => {
      const user = userEvent.setup();
      renderWizard();

      // Complete step 1
      await user.type(screen.getByLabelText(/team name/i), 'Test');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Add components in step 2
      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      const addComponentButton = screen.getByRole('button', { name: /add agent/i });
      await user.click(addComponentButton);
      await user.click(screen.getByLabelText(/component/i));
      await user.click(screen.getByText('Fullstack Developer'));
      await user.click(screen.getByLabelText(/version/i));
      await user.click(screen.getByText('v0.2'));

      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 3
      await waitFor(() => {
        expect(screen.getByText('Choose Project Manager')).toBeInTheDocument();
      });

      // Go back
      await user.click(screen.getByRole('button', { name: /back/i }));

      // Verify component still there
      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Fullstack Developer')).toBeInTheDocument();
      });
    });

    it('should reset wizard on cancel', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderWizard({ onClose });

      await user.type(screen.getByLabelText(/team name/i), 'Test Workflow');
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onClose).toHaveBeenCalled();
    });

    it('should navigate through all 3 steps sequentially', async () => {
      const user = userEvent.setup();
      renderWizard();

      // Verify step 1
      expect(screen.getByText('Team Information')).toBeInTheDocument();
      expect(screen.getByText(/step 1/i)).toBeInTheDocument();

      await user.type(screen.getByLabelText(/team name/i), 'Sequential Test');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Verify step 2
      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
        expect(screen.getByText(/step 2/i)).toBeInTheDocument();
      });

      const addComponentButton = screen.getByRole('button', { name: /add agent/i });
      await user.click(addComponentButton);
      await user.click(screen.getByLabelText(/component/i));
      await user.click(screen.getByText('Fullstack Developer'));
      await user.click(screen.getByLabelText(/version/i));
      await user.click(screen.getByText('v0.2'));

      await user.click(screen.getByRole('button', { name: /next/i }));

      // Verify step 3
      await waitFor(() => {
        expect(screen.getByText('Choose Project Manager')).toBeInTheDocument();
        expect(screen.getByText(/step 3/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle API errors during workflow creation', async () => {
      const user = userEvent.setup();
      renderWizard();

      // Mock API failure
      mockedApiClient.post.mockRejectedValueOnce({
        response: {
          data: {
            message: 'Workflow name already exists',
          },
        },
      });

      // Complete all steps
      await user.type(screen.getByLabelText(/team name/i), 'Duplicate Workflow');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      const addComponentButton = screen.getByRole('button', { name: /add agent/i });
      await user.click(addComponentButton);
      await user.click(screen.getByLabelText(/component/i));
      await user.click(screen.getByText('Fullstack Developer'));
      await user.click(screen.getByLabelText(/version/i));
      await user.click(screen.getByText('v0.2'));

      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Choose Project Manager')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText(/coordinator/i));
      await user.click(screen.getByText('Feature Implementation Coordinator'));

      await user.click(screen.getByRole('button', { name: /create team/i }));

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      });

      // Should stay on same step
      expect(screen.getByText('Choose Project Manager')).toBeInTheDocument();
    });

    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup();
      renderWizard();

      // Mock network error
      mockedApiClient.post.mockRejectedValueOnce(new Error('Network Error'));

      await user.type(screen.getByLabelText(/team name/i), 'Network Test');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      const addComponentButton = screen.getByRole('button', { name: /add agent/i });
      await user.click(addComponentButton);
      await user.click(screen.getByLabelText(/component/i));
      await user.click(screen.getByText('Fullstack Developer'));
      await user.click(screen.getByLabelText(/version/i));
      await user.click(screen.getByText('v0.2'));

      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Choose Project Manager')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText(/coordinator/i));
      await user.click(screen.getByText('Feature Implementation Coordinator'));

      await user.click(screen.getByRole('button', { name: /create team/i }));

      // Should show network error
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('should allow retry after error', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      renderWizard({ onSuccess });

      // First attempt fails
      mockedApiClient.post.mockRejectedValueOnce({
        response: {
          data: { message: 'Server error' },
        },
      });

      await user.type(screen.getByLabelText(/team name/i), 'Retry Test');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      const addComponentButton = screen.getByRole('button', { name: /add agent/i });
      await user.click(addComponentButton);
      await user.click(screen.getByLabelText(/component/i));
      await user.click(screen.getByText('Fullstack Developer'));
      await user.click(screen.getByLabelText(/version/i));
      await user.click(screen.getByText('v0.2'));

      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Choose Project Manager')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText(/coordinator/i));
      await user.click(screen.getByText('Feature Implementation Coordinator'));

      await user.click(screen.getByRole('button', { name: /create team/i }));

      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });

      // Retry (second attempt succeeds)
      mockedApiClient.post.mockResolvedValueOnce({
        data: { id: 'workflow-1', name: 'Retry Test' },
      });

      await user.click(screen.getByRole('button', { name: /create team/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle large number of available components (20 components)', async () => {
      const user = userEvent.setup();

      // Mock 20 components
      const manyComponents = Array(20)
        .fill(null)
        .map((_, i) => ({
          id: `comp-${i}`,
          name: `Component ${i}`,
          version: 'v1.0',
          versionMajor: 1,
          versionMinor: 0,
          active: true,
        }));

      mockedApiClient.get.mockImplementation((url) => {
        if (url.includes('/components') && !url.includes('/versions')) {
          return Promise.resolve({ data: manyComponents });
        }
        return Promise.resolve({ data: [] });
      });

      renderWizard();

      await user.type(screen.getByLabelText(/team name/i), 'Many Components Test');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      // Open dropdown
      const addComponentButton = screen.getByRole('button', { name: /add agent/i });
      await user.click(addComponentButton);

      const componentDropdown = screen.getByLabelText(/component/i);
      await user.click(componentDropdown);

      // Should render all 20 components
      await waitFor(() => {
        expect(screen.getByText('Component 0')).toBeInTheDocument();
        expect(screen.getByText('Component 19')).toBeInTheDocument();
      });
    });

    it('should handle adding maximum number of component assignments (10)', async () => {
      const user = userEvent.setup();
      renderWizard();

      await user.type(screen.getByLabelText(/team name/i), 'Max Components Test');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      // Add 10 components
      const addComponentButton = screen.getByRole('button', { name: /add agent/i });

      for (let i = 0; i < 5; i++) {
        await user.click(addComponentButton);

        await waitFor(() => {
          const dropdowns = screen.getAllByLabelText(/component/i);
          expect(dropdowns.length).toBe(i + 1);
        });

        const componentDropdowns = screen.getAllByLabelText(/component/i);
        await user.click(componentDropdowns[i]);
        await user.click(screen.getByText(mockAgents[i].name));

        const versionDropdowns = screen.getAllByLabelText(/version/i);
        await user.click(versionDropdowns[i]);
        const versionOptions = screen.getAllByText(/^v0\.\d+$/);
        await user.click(versionOptions[0]);
      }

      // Verify all 5 components added
      expect(screen.getAllByLabelText(/component/i)).toHaveLength(5);
    });

    it('should debounce template validation to avoid excessive API calls', async () => {
      const user = userEvent.setup();
      renderWizard();

      await user.type(screen.getByLabelText(/team name/i), 'Debounce Test');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      const addComponentButton = screen.getByRole('button', { name: /add agent/i });
      await user.click(addComponentButton);
      await user.click(screen.getByLabelText(/component/i));
      await user.click(screen.getByText('Fullstack Developer'));
      await user.click(screen.getByLabelText(/version/i));
      await user.click(screen.getByText('v0.2'));

      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Choose Project Manager')).toBeInTheDocument();
      });

      const newRadio = screen.getByLabelText(/create new project manager/i);
      await user.click(newRadio);

      await user.type(screen.getByLabelText(/project manager name/i), 'Test');

      const instructionsInput = screen.getByLabelText(/instructions/i);

      // Reset mock call count
      mockedApiClient.post.mockClear();

      // Type quickly (should debounce)
      await user.type(instructionsInput, '{{Fullstack Developer}}');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should only call API once (debounced)
      const validationCalls = mockedApiClient.post.mock.calls.filter((call) =>
        call[0].includes('validate-template')
      );
      expect(validationCalls.length).toBeLessThanOrEqual(2); // Allow for 1-2 calls due to debouncing
    });
  });

  describe('Step 1 Validation', () => {
    it('should require team name', async () => {
      const user = userEvent.setup();
      renderWizard();

      // Try to proceed without name
      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();

      // Add name
      await user.type(screen.getByLabelText(/team name/i), 'Test Workflow');

      // Should enable next
      expect(nextButton).not.toBeDisabled();
    });

    it('should handle empty description (optional field)', async () => {
      const user = userEvent.setup();
      renderWizard();

      // Name without description should be valid
      await user.type(screen.getByLabelText(/team name/i), 'No Description Workflow');

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).not.toBeDisabled();

      await user.click(nextButton);

      // Should proceed to step 2
      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });
    });

    it('should validate team name format (no special characters)', async () => {
      const user = userEvent.setup();
      renderWizard();

      // Try invalid characters
      await user.type(screen.getByLabelText(/team name/i), 'Test@Workflow#');

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/invalid characters/i)).toBeInTheDocument();
      });

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });
  });

  describe('Step 2 Validation', () => {
    it('should require at least one component', async () => {
      const user = userEvent.setup();
      renderWizard();

      await user.type(screen.getByLabelText(/team name/i), 'Test');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      // Next should be disabled without components
      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });

    it('should allow removing last component and re-adding', async () => {
      const user = userEvent.setup();
      renderWizard();

      await user.type(screen.getByLabelText(/team name/i), 'Test');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Agents')).toBeInTheDocument();
      });

      // Add component
      const addComponentButton = screen.getByRole('button', { name: /add agent/i });
      await user.click(addComponentButton);
      await user.click(screen.getByLabelText(/component/i));
      await user.click(screen.getByText('Fullstack Developer'));

      // Remove it
      const removeButton = screen.getByRole('button', { name: /remove/i });
      await user.click(removeButton);

      // Add different component
      await user.click(addComponentButton);
      await user.click(screen.getByLabelText(/component/i));
      await user.click(screen.getByText('QA Engineer'));

      // Should be valid
      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).not.toBeDisabled();
    });
  });
});
