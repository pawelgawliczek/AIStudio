import { describe, it, expect } from 'vitest';
import { terminology, translate, toTechnical } from './terminology';

describe('terminology utility', () => {
  describe('singular forms', () => {
    it('should translate workflow to Team', () => {
      expect(terminology.workflow).toBe('Team');
    });

    it('should translate component to Agent', () => {
      expect(terminology.component).toBe('Agent');
    });

    it('should translate coordinator to Project Manager', () => {
      expect(terminology.coordinator).toBe('Project Manager');
    });
  });

  describe('plural forms', () => {
    it('should translate workflows to Teams', () => {
      expect(terminology.workflows).toBe('Teams');
    });

    it('should translate components to Agents', () => {
      expect(terminology.components).toBe('Agents');
    });

    it('should translate coordinators to Project Managers', () => {
      expect(terminology.coordinators).toBe('Project Managers');
    });
  });

  describe('action verbs', () => {
    it('should translate createWorkflow to Create Team', () => {
      expect(terminology.createWorkflow).toBe('Create Team');
    });

    it('should translate editComponent to Edit Agent', () => {
      expect(terminology.editComponent).toBe('Edit Agent');
    });

    it('should translate deleteCoordinator to Delete Project Manager', () => {
      expect(terminology.deleteCoordinator).toBe('Delete Project Manager');
    });
  });

  describe('status messages', () => {
    it('should provide workflowCreated message', () => {
      expect(terminology.workflowCreated).toBe('Team created successfully');
    });

    it('should provide componentUpdated message', () => {
      expect(terminology.componentUpdated).toBe('Agent updated successfully');
    });

    it('should provide coordinatorDeleted message', () => {
      expect(terminology.coordinatorDeleted).toBe('Project Manager deleted successfully');
    });
  });

  describe('translate() helper', () => {
    it('should translate keys to user-friendly names', () => {
      expect(translate('workflow')).toBe('Team');
      expect(translate('workflows')).toBe('Teams');
      expect(translate('component')).toBe('Agent');
      expect(translate('coordinator')).toBe('Project Manager');
    });

    it('should translate action verbs', () => {
      expect(translate('createWorkflow')).toBe('Create Team');
      expect(translate('editComponent')).toBe('Edit Agent');
    });
  });

  describe('toTechnical() reverse mapping', () => {
    it('should convert user-friendly names to technical terms', () => {
      expect(toTechnical('Team')).toBe('workflow');
      expect(toTechnical('Teams')).toBe('workflows');
      expect(toTechnical('Agent')).toBe('component');
      expect(toTechnical('Agents')).toBe('components');
      expect(toTechnical('Project Manager')).toBe('coordinator');
      expect(toTechnical('Project Managers')).toBe('coordinators');
    });

    it('should return undefined for unknown terms', () => {
      expect(toTechnical('Unknown Term')).toBeUndefined();
    });
  });

  describe('type safety', () => {
    it('should enforce valid keys for translate()', () => {
      // This test verifies TypeScript compilation
      // Invalid keys would cause TypeScript errors at compile time
      const validKey: keyof typeof terminology = 'workflow';
      expect(translate(validKey)).toBe('Team');
    });
  });
});
