/**
 * Versioning MCP Tools
 * Tools for version management of components, coordinators, and workflows
 */

import * as listComponents from './list_components';
import * as getComponent from './get_component';
import * as createComponentVersion from './create_component_version';
import * as listCoordinators from './list_coordinators';
import * as getCoordinator from './get_coordinator';
import * as createCoordinatorVersion from './create_coordinator_version';
import * as getVersionHistory from './get_version_history';
import * as compareVersions from './compare_versions';

export const tools = [
  listComponents,
  getComponent,
  createComponentVersion,
  listCoordinators,
  getCoordinator,
  createCoordinatorVersion,
  getVersionHistory,
  compareVersions,
];

export {
  listComponents,
  getComponent,
  createComponentVersion,
  listCoordinators,
  getCoordinator,
  createCoordinatorVersion,
  getVersionHistory,
  compareVersions,
};
