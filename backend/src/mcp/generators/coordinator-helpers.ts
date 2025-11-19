import { Component } from '@prisma/client';

/**
 * Helper functions to work with coordinators stored as components
 */

export function extractCoordinatorFields(coordinator: Component) {
  const config = (coordinator.config as any) || {};

  return {
    domain: config.domain || coordinator.tags.find(t => !['coordinator', 'orchestrator'].includes(t)),
    decisionStrategy: config.decisionStrategy || 'adaptive',
    componentIds: config.componentIds || [],
    flowDiagram: config.flowDiagram,
    coordinatorInstructions: coordinator.operationInstructions,
  };
}

export function isCoordinator(component: Component): boolean {
  return component.tags.includes('coordinator');
}
