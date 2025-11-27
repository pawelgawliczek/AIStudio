import * as activateComponent from './activate_component';
import * as createComponent from './create_component';
import * as deactivateComponent from './deactivate_component';
import * as getComponentInstructions from './get_component_instructions';
import * as getComponentUsage from './get_component_usage';
import * as updateComponent from './update_component';

export const tools = [
  createComponent,
  updateComponent,
  activateComponent,
  deactivateComponent,
  getComponentUsage,
  getComponentInstructions,
];
