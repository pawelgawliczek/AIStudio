import * as activateCoordinator from './activate_coordinator';
import * as createCoordinator from './create_coordinator';
import * as deactivateCoordinator from './deactivate_coordinator';
import * as getCoordinatorUsage from './get_coordinator_usage';
// update_project_manager is now an alias in components/update_component.ts

export const tools = [
  createCoordinator,
  activateCoordinator,
  deactivateCoordinator,
  getCoordinatorUsage,
];
