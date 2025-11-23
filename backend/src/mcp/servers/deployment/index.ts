/**
 * Deployment MCP Server
 *
 * Provides tools for deploying stories to test and production environments
 */

import * as deployToTestEnv from './deploy_to_test_env.js';
import * as deployToProduction from './deploy_to_production.js';
import * as approveDeployment from './approve_deployment.js';

export const tools = [deployToTestEnv, deployToProduction, approveDeployment];

export { deployToTestEnv, deployToProduction, approveDeployment };
