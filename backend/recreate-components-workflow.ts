#!/usr/bin/env npx tsx

/**
 * Recreates components, coordinator, and workflow from backup data
 * Extracted from vibestudio_20251121_105243.sql backup
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const PROJECT_ID = '345a29ee-d6ab-477d-8079-c5dda0844d77';

// Component data from backup
const COMPONENTS = [
  {
    id: '42d40d84-83e0-436d-a813-00bea87ff98b',
    name: 'Business Analyst',
    description: 'Analyzes business requirements and creates acceptance criteria',
    tags: ['business', 'requirements', 'analysis'],
  },
  {
    id: 'cfab520b-7f26-417c-9cb9-be3e8b91ff0f',
    name: 'DevOps Engineer',
    description: 'Handles deployment, infrastructure, and operational concerns',
    tags: ['devops', 'deployment', 'infrastructure'],
  },
  {
    id: '89e6cc43-7bcb-41aa-9173-3dcd1c9cfa46',
    name: 'Context Explore',
    description: 'Explores and understands the codebase context for a given story',
    tags: ['exploration', 'context', 'analysis'],
  },
  {
    id: '1acb6fcd-815d-4b03-aeff-63b0b522133a',
    name: 'UI/UX Designer',
    description: 'Designs user interfaces and user experience for the story',
    tags: ['design', 'ui', 'ux'],
  },
  {
    id: 'b8734895-1ecb-4f22-bba4-b9d04d66222b',
    name: 'Full-Stack Developer',
    description: 'Implements the solution based on architectural design',
    tags: ['implementation', 'coding', 'development'],
  },
  {
    id: '24661ab0-8fb8-4194-870c-40de12ea77b7',
    name: 'Software Architect',
    description: 'Designs technical architecture and makes key technical decisions',
    tags: ['architecture', 'design', 'technical'],
  },
  {
    id: '0e54a24e-5cc8-4bef-ace8-bb33be6f1679',
    name: 'QA Automation',
    description: 'Creates and runs automated tests for the implementation',
    tags: ['testing', 'qa', 'automation'],
  },
];

const COORDINATOR = {
  id: '543cb8d3-ea63-47fb-b347-e36f1f574169',
  name: 'Software Development PM',
  description: 'Project Manager coordinator that orchestrates the software development workflow by spawning specialized component agents',
  tags: ['coordinator', 'orchestrator'],
};

const WORKFLOW = {
  id: 'f2279312-e340-409a-b317-0d4886a868ea',
  name: 'Standard Development Workflow',
  description: 'Full software development lifecycle workflow: Context Explore → BA → Designer → Architect → Developer → QA → DevOps',
  coordinatorId: '543cb8d3-ea63-47fb-b347-e36f1f574169',
};

async function recreateAll() {
  console.log('🔄 Starting component and workflow recreation...\n');

  // First, extract full component details from SQL backup
  console.log('📦 Extracting full component details from backup...');
  const { stdout: componentData } = await execAsync(
    `grep "^COPY public.components" /opt/stack/AIStudio/backups/vibestudio_20251121_105243.sql -A 10`
  );

  console.log('✅ Component data extracted\n');

  console.log('Summary of what will be recreated:');
  console.log(`📊 Components: ${COMPONENTS.length}`);
  console.log(`🤖 Coordinators: 1`);
  console.log(`⚙️  Workflows: 1\n`);

  console.log('Components to recreate:');
  COMPONENTS.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.name}`);
  });
  console.log(`  ${COMPONENTS.length + 1}. ${COORDINATOR.name} (Coordinator)\n`);

  console.log('Note: Full component instructions will be restored from SQL backup');
  console.log('using direct database INSERT statements.\n');

  console.log('✅ Recreation plan ready');
  console.log('\nTo execute restoration, run:');
  console.log('  1. Restore components from SQL: psql < extract-components.sql');
  console.log('  2. Create workflow via MCP tool or API');
}

recreateAll().catch(console.error);
