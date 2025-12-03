import React, { createContext, useContext, useState, ReactNode } from 'react';
import { WizardState, WizardStep, ComponentAssignment } from '../types/workflow-wizard';

interface WorkflowWizardContextType {
  state: WizardState;
  currentStep: WizardStep;
  updateState: (updates: Partial<WizardState>) => void;
  addComponentAssignment: (assignment: ComponentAssignment) => void;
  removeComponentAssignment: (index: number) => void;
  updateComponentAssignment: (index: number, assignment: ComponentAssignment) => void;
  goToStep: (step: WizardStep) => void;
  nextStep: () => void;
  previousStep: () => void;
  resetWizard: () => void;
  canProceedToStep: (step: WizardStep) => boolean;
}

const WorkflowWizardContext = createContext<WorkflowWizardContextType | undefined>(undefined);

const initialState: WizardState = {
  name: '',
  description: '',
  projectId: '',
  componentAssignments: [],
  triggerConfig: {
    type: 'manual',
  },
  active: true,
};

interface WorkflowWizardProviderProps {
  children: ReactNode;
  projectId: string;
}

export const WorkflowWizardProvider: React.FC<WorkflowWizardProviderProps> = ({ children, projectId }) => {
  const [state, setState] = useState<WizardState>({
    ...initialState,
    projectId,
  });
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  const updateState = (updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const addComponentAssignment = (assignment: ComponentAssignment) => {
    setState((prev) => ({
      ...prev,
      componentAssignments: [...prev.componentAssignments, assignment],
    }));
  };

  const removeComponentAssignment = (index: number) => {
    setState((prev) => ({
      ...prev,
      componentAssignments: prev.componentAssignments.filter((_, i) => i !== index),
    }));
  };

  const updateComponentAssignment = (index: number, assignment: ComponentAssignment) => {
    setState((prev) => ({
      ...prev,
      componentAssignments: prev.componentAssignments.map((item, i) => (i === index ? assignment : item)),
    }));
  };

  const canProceedToStep = (step: WizardStep): boolean => {
    if (step === 1) return true;

    if (step === 2) {
      // Can proceed to step 2 if step 1 is complete (name and projectId)
      return state.name.trim().length > 0 && state.projectId.trim().length > 0;
    }

    if (step === 3) {
      // Can proceed to step 3 if step 2 is complete (at least one component assigned)
      return state.componentAssignments.length > 0;
    }

    return false;
  };

  const goToStep = (step: WizardStep) => {
    if (canProceedToStep(step)) {
      setCurrentStep(step);
    }
  };

  const nextStep = () => {
    if (currentStep < 3 && canProceedToStep((currentStep + 1) as WizardStep)) {
      setCurrentStep((prev) => (prev + 1) as WizardStep);
    }
  };

  const previousStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  };

  const resetWizard = () => {
    setState({ ...initialState, projectId });
    setCurrentStep(1);
  };

  const value: WorkflowWizardContextType = {
    state,
    currentStep,
    updateState,
    addComponentAssignment,
    removeComponentAssignment,
    updateComponentAssignment,
    goToStep,
    nextStep,
    previousStep,
    resetWizard,
    canProceedToStep,
  };

  return <WorkflowWizardContext.Provider value={value}>{children}</WorkflowWizardContext.Provider>;
};

export const useWorkflowWizard = (): WorkflowWizardContextType => {
  const context = useContext(WorkflowWizardContext);
  if (!context) {
    throw new Error('useWorkflowWizard must be used within a WorkflowWizardProvider');
  }
  return context;
};
