/**
 * Deployment MCP Server
 *
 * Provides tools for deploying stories to test and production environments
 */

import * as approveDeployment from './approve_deployment.js';
import * as deployToProduction from './deploy_to_production.js';
import * as deployToTestEnv from './deploy_to_test_env.js';
import * as seedTestDatabase from './seed_test_database.js';
import * as testHealthChecks from './test_health_checks.js';

export const tools = [deployToTestEnv, deployToProduction, approveDeployment, testHealthChecks, seedTestDatabase];

export { deployToTestEnv, deployToProduction, approveDeployment, testHealthChecks, seedTestDatabase };
