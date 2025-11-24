import { renderHook, act } from '@testing-library/react';
import { WorkflowWizardProvider, useWorkflowWizard } from '../WorkflowWizardContext';
import type { ComponentAssignment } from '../../types/workflow-wizard';

const createWrapper = (projectId: string = 'test-project-id') => {
  return ({ children }: { children: React.ReactNode }) => (
    <WorkflowWizardProvider projectId={projectId}>{children}</WorkflowWizardProvider>
  );
};

describe('WorkflowWizardContext', () => {
  describe('Initial state', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper('test-project-id'),
      });

      expect(result.current.state.name).toBe('');
      expect(result.current.state.description).toBe('');
      expect(result.current.state.projectId).toBe('test-project-id');
      expect(result.current.state.componentAssignments).toEqual([]);
      expect(result.current.state.coordinatorMode).toBe('existing');
      expect(result.current.currentStep).toBe(1);
    });

    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useWorkflowWizard());
      }).toThrow('useWorkflowWizard must be used within a WorkflowWizardProvider');

      spy.mockRestore();
    });
  });

  describe('updateState', () => {
    it('should update workflow name', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateState({ name: 'Test Workflow' });
      });

      expect(result.current.state.name).toBe('Test Workflow');
    });

    it('should update multiple fields at once', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateState({
          name: 'Test Workflow',
          description: 'Test description',
        });
      });

      expect(result.current.state.name).toBe('Test Workflow');
      expect(result.current.state.description).toBe('Test description');
    });

    it('should preserve other state when updating', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateState({ name: 'First' });
      });

      act(() => {
        result.current.updateState({ description: 'Second' });
      });

      expect(result.current.state.name).toBe('First');
      expect(result.current.state.description).toBe('Second');
    });
  });

  describe('Component assignments', () => {
    const mockAssignment: ComponentAssignment = {
      componentName: 'Developer',
      componentId: 'comp-1',
      versionId: 'ver-1',
      version: 'v1.0',
      versionMajor: 1,
      versionMinor: 0,
    };

    it('should add component assignment', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.addComponentAssignment(mockAssignment);
      });

      expect(result.current.state.componentAssignments).toHaveLength(1);
      expect(result.current.state.componentAssignments[0]).toEqual(mockAssignment);
    });

    it('should add multiple component assignments', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper(),
      });

      const assignment2: ComponentAssignment = {
        ...mockAssignment,
        componentName: 'QA Engineer',
        componentId: 'comp-2',
      };

      act(() => {
        result.current.addComponentAssignment(mockAssignment);
        result.current.addComponentAssignment(assignment2);
      });

      expect(result.current.state.componentAssignments).toHaveLength(2);
    });

    it('should remove component assignment by index', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper(),
      });

      const assignment2: ComponentAssignment = {
        ...mockAssignment,
        componentName: 'QA Engineer',
        componentId: 'comp-2',
      };

      act(() => {
        result.current.addComponentAssignment(mockAssignment);
        result.current.addComponentAssignment(assignment2);
      });

      act(() => {
        result.current.removeComponentAssignment(0);
      });

      expect(result.current.state.componentAssignments).toHaveLength(1);
      expect(result.current.state.componentAssignments[0].componentName).toBe('QA Engineer');
    });

    it('should update component assignment by index', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.addComponentAssignment(mockAssignment);
      });

      const updatedAssignment: ComponentAssignment = {
        ...mockAssignment,
        version: 'v2.0',
        versionMajor: 2,
        versionMinor: 0,
      };

      act(() => {
        result.current.updateComponentAssignment(0, updatedAssignment);
      });

      expect(result.current.state.componentAssignments[0].version).toBe('v2.0');
    });

    it('should preserve other assignments when updating one', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper(),
      });

      const assignment2: ComponentAssignment = {
        ...mockAssignment,
        componentName: 'QA Engineer',
        componentId: 'comp-2',
      };

      act(() => {
        result.current.addComponentAssignment(mockAssignment);
        result.current.addComponentAssignment(assignment2);
      });

      const updatedAssignment: ComponentAssignment = {
        ...mockAssignment,
        version: 'v2.0',
      };

      act(() => {
        result.current.updateComponentAssignment(0, updatedAssignment);
      });

      expect(result.current.state.componentAssignments[0].version).toBe('v2.0');
      expect(result.current.state.componentAssignments[1].componentName).toBe('QA Engineer');
    });
  });

  describe('Step navigation', () => {
    it('should start at step 1', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper(),
      });

      expect(result.current.currentStep).toBe(1);
    });

    it('should not proceed to step 2 without name and projectId', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper(),
      });

      expect(result.current.canProceedToStep(2)).toBe(false);
    });

    it('should proceed to step 2 with valid step 1 data', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper('test-project'),
      });

      act(() => {
        result.current.updateState({ name: 'Test Workflow' });
      });

      expect(result.current.canProceedToStep(2)).toBe(true);
    });

    it('should advance to next step when valid', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper('test-project'),
      });

      act(() => {
        result.current.updateState({ name: 'Test Workflow' });
      });

      act(() => {
        result.current.nextStep();
      });

      expect(result.current.currentStep).toBe(2);
    });

    it('should not advance to step 3 without components', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper('test-project'),
      });

      act(() => {
        result.current.updateState({ name: 'Test Workflow' });
        result.current.nextStep();
      });

      expect(result.current.canProceedToStep(3)).toBe(false);
    });

    it('should advance to step 3 with at least one component', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper('test-project'),
      });

      const mockAssignment: ComponentAssignment = {
        componentName: 'Developer',
        componentId: 'comp-1',
        versionId: 'ver-1',
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
      };

      act(() => {
        result.current.updateState({ name: 'Test Workflow' });
      });

      act(() => {
        result.current.nextStep();
      });

      act(() => {
        result.current.addComponentAssignment(mockAssignment);
      });

      expect(result.current.canProceedToStep(3)).toBe(true);

      act(() => {
        result.current.nextStep();
      });

      expect(result.current.currentStep).toBe(3);
    });

    it('should go back to previous step', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper('test-project'),
      });

      act(() => {
        result.current.updateState({ name: 'Test Workflow' });
      });

      act(() => {
        result.current.nextStep();
      });

      expect(result.current.currentStep).toBe(2);

      act(() => {
        result.current.previousStep();
      });

      expect(result.current.currentStep).toBe(1);
    });

    it('should not go back from step 1', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.previousStep();
      });

      expect(result.current.currentStep).toBe(1);
    });

    it('should not advance beyond step 3', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper('test-project'),
      });

      const mockAssignment: ComponentAssignment = {
        componentName: 'Developer',
        componentId: 'comp-1',
        versionId: 'ver-1',
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
      };

      act(() => {
        result.current.updateState({ name: 'Test Workflow' });
      });

      act(() => {
        result.current.addComponentAssignment(mockAssignment);
      });

      act(() => {
        result.current.goToStep(3);
      });

      expect(result.current.currentStep).toBe(3);

      act(() => {
        result.current.nextStep();
      });

      expect(result.current.currentStep).toBe(3); // Should stay at 3
    });

    it('should jump to step directly if allowed', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper('test-project'),
      });

      const mockAssignment: ComponentAssignment = {
        componentName: 'Developer',
        componentId: 'comp-1',
        versionId: 'ver-1',
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
      };

      act(() => {
        result.current.updateState({ name: 'Test Workflow' });
        result.current.addComponentAssignment(mockAssignment);
      });

      act(() => {
        result.current.goToStep(3);
      });

      expect(result.current.currentStep).toBe(3);
    });

    it('should not jump to step if prerequisites not met', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.goToStep(3);
      });

      expect(result.current.currentStep).toBe(1); // Should stay at 1
    });
  });

  describe('resetWizard', () => {
    it('should reset to initial state', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper('test-project'),
      });

      const mockAssignment: ComponentAssignment = {
        componentName: 'Developer',
        componentId: 'comp-1',
        versionId: 'ver-1',
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
      };

      act(() => {
        result.current.updateState({
          name: 'Test Workflow',
          description: 'Test description',
        });
      });

      act(() => {
        result.current.addComponentAssignment(mockAssignment);
      });

      act(() => {
        result.current.nextStep();
      });

      expect(result.current.state.name).toBe('Test Workflow');
      expect(result.current.state.componentAssignments).toHaveLength(1);
      expect(result.current.currentStep).toBe(2);

      act(() => {
        result.current.resetWizard();
      });

      expect(result.current.state.name).toBe('');
      expect(result.current.state.description).toBe('');
      expect(result.current.state.componentAssignments).toEqual([]);
      expect(result.current.currentStep).toBe(1);
      expect(result.current.state.projectId).toBe('test-project'); // Should preserve projectId
    });
  });

  describe('Validation edge cases', () => {
    it('should trim whitespace in name validation', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper('test-project'),
      });

      act(() => {
        result.current.updateState({ name: '   ' }); // Only whitespace
      });

      expect(result.current.canProceedToStep(2)).toBe(false);
    });

    it('should require both name and projectId', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper(''), // Empty projectId
      });

      act(() => {
        result.current.updateState({ name: 'Test' });
      });

      expect(result.current.canProceedToStep(2)).toBe(false);

      act(() => {
        result.current.updateState({ projectId: 'test-project' });
      });

      expect(result.current.canProceedToStep(2)).toBe(true);
    });

    it('should allow proceeding to step 1 always', () => {
      const { result } = renderHook(() => useWorkflowWizard(), {
        wrapper: createWrapper(),
      });

      expect(result.current.canProceedToStep(1)).toBe(true);
    });
  });
});
