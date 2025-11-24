/**
 * E2E Test: Workflow Creation Wizard (ST-90)
 *
 * Tests the complete 3-step workflow creation process including:
 * - Step 1: Workflow shell creation (name, description, project)
 * - Step 2: Component version selection with unique name validation
 * - Step 3: Coordinator selection (existing) or creation (new) with template validation
 *
 * Covers acceptance criteria:
 * - AC-1: Workflow shell creation
 * - AC-2: Component version selection with duplicate detection
 * - AC-3: Existing coordinator selection with template preview
 * - AC-4: New coordinator creation with template validation
 * - AC-5: Template validation error handling
 * - AC-7: End-to-end workflow creation
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkflowCreationWizard } from '../components/workflow-wizard/WorkflowCreationWizard';
import { apiClient } from '../services/api-client';

// Mock API client
jest.mock('../services/api-client');
const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

const mockProjects = [
  { id: 'project-1', name: 'E-Commerce Platform' },
  { id: 'project-2', name: 'Analytics Dashboard' },
];

const mockComponents = [
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
];

const mockComponentVersions = {
  'comp-1': [
    { id: 'ver-1-2', version: 'v0.2', versionMajor: 0, versionMinor: 2, isDeprecated: false },
    { id: 'ver-1-1', version: 'v0.1', versionMajor: 0, versionMinor: 1, isDeprecated: false },
  ],
  'comp-2': [
    { id: 'ver-2-5', version: 'v0.5', versionMajor: 0, versionMinor: 5, isDeprecated: false },
    { id: 'ver-2-4', version: 'v0.4', versionMajor: 0, versionMinor: 4, isDeprecated: false },
  ],
  'comp-3': [
    { id: 'ver-3-3', version: 'v0.3', versionMajor: 0, versionMinor: 3, isDeprecated: false },
  ],
};

const mockCoordinators = [
  {
    id: 'coord-1',
    name: 'Feature Implementation Coordinator',
    version: 'v1.2',
    versionMajor: 1,
    versionMinor: 2,
    operationInstructions: 'Use {{PM Agent}}, {{Fullstack Developer}}, and {{QA Engineer}} to implement features',
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
    onClose: jest.fn(),
    onSuccess: jest.fn(),
    projectId: 'project-1',
    projects: mockProjects,
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <WorkflowCreationWizard {...defaultProps} {...props} />
    </QueryClientProvider>
  );
}

describe('Workflow Creation Wizard E2E', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock API responses
    mockedApiClient.get.mockImplementation((url) => {
      if (url.includes('/components')) {
        return Promise.resolve({ data: mockComponents });
      }
      if (url.includes('/coordinators')) {
        return Promise.resolve({ data: mockCoordinators });
      }
      if (url.includes('/versions')) {
        const componentId = url.split('/')[3];
        return Promise.resolve({ data: mockComponentVersions[componentId] || [] });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    mockedApiClient.post.mockImplementation((url, data) => {
      if (url.includes('/workflows')) {
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
        // Simple validation logic for testing
        const { instructions, componentNames } = data;
        const regex = /\{\{([^}]+)\}\}/g;
        const matches = [...instructions.matchAll(regex)];
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

  describe('AC-7: Complete Workflow Creation Flow (Happy Path)', () => {
    it('should create workflow with existing coordinator through all 3 steps', async () => {
      const user = userEvent.setup();
      const onSuccess = jest.fn();
      const onClose = jest.fn();

      renderWizard({ onSuccess, onClose });

      // Step 1: Workflow Shell
      expect(screen.getByText('Create New Workflow')).toBeInTheDocument();
      expect(screen.getByText('Workflow Information')).toBeInTheDocument();

      const nameInput = screen.getByLabelText(/workflow name/i);
      const descriptionInput = screen.getByLabelText(/description/i);

      await user.type(nameInput, 'Feature Implementation Flow');
      await user.type(descriptionInput, 'Automated feature implementation for web app');

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).not.toBeDisabled();

      await user.click(nextButton);

      // Step 2: Component Selection
      await waitFor(() => {
        expect(screen.getByText('Select Components')).toBeInTheDocument();
      });

      // Add first component
      const addComponentButton = screen.getByRole('button', { name: /add component/i });
      await user.click(addComponentButton);

      // Wait for component dropdown to be visible
      await waitFor(() => {
        expect(screen.getByLabelText(/component/i)).toBeInTheDocument();
      });

      const componentDropdown = screen.getByLabelText(/component/i);
      await user.click(componentDropdown);
      await user.click(screen.getByText('Fullstack Developer'));

      // Select version
      const versionDropdown = screen.getByLabelText(/version/i);
      await user.click(versionDropdown);
      await user.click(screen.getByText('v0.2'));

      // Add second component
      await user.click(addComponentButton);

      const componentDropdowns = screen.getAllByLabelText(/component/i);
      await user.click(componentDropdowns[1]);
      await user.click(screen.getByText('QA Engineer'));

      const versionDropdowns = screen.getAllByLabelText(/version/i);
      await user.click(versionDropdowns[1]);
      await user.click(screen.getByText('v0.5'));

      // Proceed to step 3
      const nextButton2 = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton2);

      // Step 3: Coordinator Selection
      await waitFor(() => {
        expect(screen.getByText('Choose Coordinator')).toBeInTheDocument();
      });

      // Select existing coordinator
      const existingRadio = screen.getByLabelText(/use existing coordinator/i);
      expect(existingRadio).toBeChecked(); // Should be default

      const coordinatorDropdown = screen.getByLabelText(/coordinator/i);
      await user.click(coordinatorDropdown);
      await user.click(screen.getByText('Feature Implementation Coordinator'));

      // Submit workflow
      const createButton = screen.getByRole('button', { name: /create workflow/i });
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

      // Verify success callbacks
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('AC-2: Component Unique Name Validation', () => {
    it('should prevent adding duplicate component names', async () => {
      const user = userEvent.setup();
      renderWizard();

      // Navigate to step 2
      const nameInput = screen.getByLabelText(/workflow name/i);
      await user.type(nameInput, 'Test Workflow');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Components')).toBeInTheDocument();
      });

      // Add first component
      const addComponentButton = screen.getByRole('button', { name: /add component/i });
      await user.click(addComponentButton);

      const componentDropdown = screen.getByLabelText(/component/i);
      await user.click(componentDropdown);
      await user.click(screen.getByText('Fullstack Developer'));

      // Try to add same component again
      await user.click(addComponentButton);

      const componentDropdowns = screen.getAllByLabelText(/component/i);
      await user.click(componentDropdowns[1]);

      // Should show error when trying to select duplicate
      await user.click(screen.getAllByText('Fullstack Developer')[1]);

      await waitFor(() => {
        expect(screen.getByText(/already assigned/i)).toBeInTheDocument();
      });

      // Next button should be disabled
      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });
  });

  describe('AC-4: New Coordinator Creation with Template Validation', () => {
    it('should create new coordinator with valid template references', async () => {
      const user = userEvent.setup();
      const onSuccess = jest.fn();

      renderWizard({ onSuccess });

      // Step 1: Complete
      await user.type(screen.getByLabelText(/workflow name/i), 'Custom Bug Fix Flow');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 2: Add components
      await waitFor(() => {
        expect(screen.getByText('Select Components')).toBeInTheDocument();
      });

      const addComponentButton = screen.getByRole('button', { name: /add component/i });
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
        expect(screen.getByText('Choose Coordinator')).toBeInTheDocument();
      });

      const newRadio = screen.getByLabelText(/create new coordinator/i);
      await user.click(newRadio);

      // Fill coordinator form
      const coordinatorNameInput = screen.getByLabelText(/coordinator name/i);
      await user.type(coordinatorNameInput, 'Bug Fix Coordinator');

      const instructionsInput = screen.getByLabelText(/instructions/i);
      await user.type(instructionsInput, '1. {{Fullstack Developer}} fixes the bug\n2. Test the fix');

      // Select model
      const modelDropdown = screen.getByLabelText(/model/i);
      await user.click(modelDropdown);
      await user.click(screen.getByText('claude-sonnet-4.5'));

      // Submit
      const createButton = screen.getByRole('button', { name: /create workflow/i });
      await user.click(createButton);

      // Verify coordinator creation API call
      await waitFor(() => {
        expect(mockedApiClient.post).toHaveBeenCalledWith(
          expect.stringContaining('/components'),
          expect.objectContaining({
            name: 'Bug Fix Coordinator',
            operationInstructions: expect.stringContaining('{{Fullstack Developer}}'),
          })
        );
      });

      // Verify workflow creation with new coordinator
      expect(mockedApiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/workflows'),
        expect.objectContaining({
          name: 'Custom Bug Fix Flow',
          coordinatorId: 'new-coord-1',
        })
      );

      expect(onSuccess).toHaveBeenCalled();
    });
  });

  describe('AC-5: Template Validation Error Handling', () => {
    it('should show validation errors for invalid template references', async () => {
      const user = userEvent.setup();
      renderWizard();

      // Navigate to step 3
      await user.type(screen.getByLabelText(/workflow name/i), 'Test Workflow');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Components')).toBeInTheDocument();
      });

      // Add one component
      const addComponentButton = screen.getByRole('button', { name: /add component/i });
      await user.click(addComponentButton);
      await user.click(screen.getByLabelText(/component/i));
      await user.click(screen.getByText('Fullstack Developer'));
      await user.click(screen.getByLabelText(/version/i));
      await user.click(screen.getByText('v0.2'));

      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 3: Create coordinator with invalid reference
      await waitFor(() => {
        expect(screen.getByText('Choose Coordinator')).toBeInTheDocument();
      });

      const newRadio = screen.getByLabelText(/create new coordinator/i);
      await user.click(newRadio);

      const coordinatorNameInput = screen.getByLabelText(/coordinator name/i);
      await user.type(coordinatorNameInput, 'Test Coordinator');

      const instructionsInput = screen.getByLabelText(/instructions/i);
      await user.type(
        instructionsInput,
        '1. {{Fullstack Developer}} implements\n2. {{QA Engineer}} validates'
      );

      // Wait for validation
      await waitFor(
        () => {
          expect(screen.getByText(/QA Engineer.*not found/i)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      // Create button should be disabled
      const createButton = screen.getByRole('button', { name: /create workflow/i });
      expect(createButton).toBeDisabled();
    });

    it('should allow fixing validation errors and proceeding', async () => {
      const user = userEvent.setup();
      renderWizard();

      // Complete steps 1 and 2
      await user.type(screen.getByLabelText(/workflow name/i), 'Test Workflow');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Components')).toBeInTheDocument();
      });

      const addComponentButton = screen.getByRole('button', { name: /add component/i });
      await user.click(addComponentButton);
      await user.click(screen.getByLabelText(/component/i));
      await user.click(screen.getByText('Fullstack Developer'));
      await user.click(screen.getByLabelText(/version/i));
      await user.click(screen.getByText('v0.2'));

      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 3: Enter invalid reference
      await waitFor(() => {
        expect(screen.getByText('Choose Coordinator')).toBeInTheDocument();
      });

      const newRadio = screen.getByLabelText(/create new coordinator/i);
      await user.click(newRadio);

      await user.type(screen.getByLabelText(/coordinator name/i), 'Test Coordinator');

      const instructionsInput = screen.getByLabelText(/instructions/i);
      await user.type(instructionsInput, 'Use {{QA Engineer}}'); // Invalid

      await waitFor(() => {
        expect(screen.getByText(/not found/i)).toBeInTheDocument();
      });

      // Go back and add missing component
      await user.click(screen.getByRole('button', { name: /back/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Components')).toBeInTheDocument();
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

      const createButton = screen.getByRole('button', { name: /create workflow/i });
      expect(createButton).not.toBeDisabled();
    });
  });

  describe('Navigation and State Management', () => {
    it('should preserve data when navigating between steps', async () => {
      const user = userEvent.setup();
      renderWizard();

      // Step 1
      await user.type(screen.getByLabelText(/workflow name/i), 'Persistent Workflow');
      await user.type(screen.getByLabelText(/description/i), 'Test description');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Step 2
      await waitFor(() => {
        expect(screen.getByText('Select Components')).toBeInTheDocument();
      });

      // Go back
      await user.click(screen.getByRole('button', { name: /back/i }));

      // Verify data preserved
      expect(screen.getByLabelText(/workflow name/i)).toHaveValue('Persistent Workflow');
      expect(screen.getByLabelText(/description/i)).toHaveValue('Test description');
    });

    it('should reset wizard on cancel', async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();
      renderWizard({ onClose });

      await user.type(screen.getByLabelText(/workflow name/i), 'Test Workflow');
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
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
      await user.type(screen.getByLabelText(/workflow name/i), 'Duplicate Workflow');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Components')).toBeInTheDocument();
      });

      const addComponentButton = screen.getByRole('button', { name: /add component/i });
      await user.click(addComponentButton);
      await user.click(screen.getByLabelText(/component/i));
      await user.click(screen.getByText('Fullstack Developer'));
      await user.click(screen.getByLabelText(/version/i));
      await user.click(screen.getByText('v0.2'));

      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Choose Coordinator')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText(/coordinator/i));
      await user.click(screen.getByText('Feature Implementation Coordinator'));

      await user.click(screen.getByRole('button', { name: /create workflow/i }));

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      });

      // Should stay on same step
      expect(screen.getByText('Choose Coordinator')).toBeInTheDocument();
    });
  });
});
