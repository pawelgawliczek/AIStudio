import { PrismaClient } from '@prisma/client';
import {
  createLayer,
  createComponent,
  listLayers,
  listComponents,
} from './backend/src/mcp/tools';

const prisma = new PrismaClient();
const PROJECT_ID = '345a29ee-d6ab-477d-8079-c5dda0844d77';

async function setupArchitecture() {
  console.log('🏗️  Setting up Architecture via MCP Tools...\n');

  try {
    // Create Layers
    console.log('Creating Architectural Layers...');

    const presentationLayer = await createLayer(prisma, {
      projectId: PROJECT_ID,
      name: 'Presentation Layer',
      description: 'User interfaces and client-side logic',
      techStack: ['React', 'TypeScript', 'Vite', 'TailwindCSS', 'Socket.io-client', 'React Query', 'dnd-kit'],
      orderIndex: 1,
      color: '#3B82F6',
      icon: '🌐',
      status: 'active',
    });
    console.log(`✓ Created: ${presentationLayer.name} (${presentationLayer.id})`);

    const applicationLayer = await createLayer(prisma, {
      projectId: PROJECT_ID,
      name: 'Application Layer',
      description: 'Backend services, REST API, and WebSocket gateway',
      techStack: ['NestJS', 'TypeScript', 'Node.js', 'Socket.IO', 'Passport.js', 'class-validator'],
      orderIndex: 2,
      color: '#10B981',
      icon: '⚙️',
      status: 'active',
    });
    console.log(`✓ Created: ${applicationLayer.name} (${applicationLayer.id})`);

    const domainLayer = await createLayer(prisma, {
      projectId: PROJECT_ID,
      name: 'Domain Layer',
      description: 'Core business logic and domain models',
      techStack: ['TypeScript', 'Domain Models', 'Business Rules'],
      orderIndex: 3,
      color: '#8B5CF6',
      icon: '🧠',
      status: 'active',
    });
    console.log(`✓ Created: ${domainLayer.name} (${domainLayer.id})`);

    const infrastructureLayer = await createLayer(prisma, {
      projectId: PROJECT_ID,
      name: 'Infrastructure Layer',
      description: 'Database, cache, external APIs, and deployment',
      techStack: ['PostgreSQL', 'pgvector', 'Prisma', 'Redis', 'Docker', 'Caddy', 'OpenAI API'],
      orderIndex: 4,
      color: '#F59E0B',
      icon: '🔧',
      status: 'active',
    });
    console.log(`✓ Created: ${infrastructureLayer.name} (${infrastructureLayer.id})`);

    console.log('\n🎨 Creating Components...\n');

    // Create Components
    const components = [
      {
        name: 'Authentication',
        description: 'JWT authentication, login, logout, token management',
        layerIds: [presentationLayer.id, applicationLayer.id, infrastructureLayer.id],
        filePatterns: ['**/auth/**', '**/login/**', '**/*auth*'],
        color: '#3B82F6',
        icon: '🔐',
      },
      {
        name: 'Project Management',
        description: 'Projects, Epics, Stories, Subtasks CRUD operations',
        layerIds: [presentationLayer.id, applicationLayer.id, domainLayer.id, infrastructureLayer.id],
        filePatterns: ['**/projects/**', '**/epics/**', '**/stories/**', '**/subtasks/**'],
        color: '#10B981',
        icon: '📊',
      },
      {
        name: 'Planning Board',
        description: 'Kanban board with drag-and-drop, story filters, bulk actions',
        layerIds: [presentationLayer.id, applicationLayer.id],
        filePatterns: ['**/planning/**', '**/kanban/**', '**/PlanningView*'],
        color: '#8B5CF6',
        icon: '🎯',
      },
      {
        name: 'Timeline View',
        description: 'Gantt-style timeline visualization for project planning',
        layerIds: [presentationLayer.id],
        filePatterns: ['**/timeline/**', '**/TimelineView*'],
        color: '#EC4899',
        icon: '📅',
      },
      {
        name: 'Use Case Library',
        description: 'Use case management with semantic search and versioning',
        layerIds: [presentationLayer.id, applicationLayer.id, domainLayer.id, infrastructureLayer.id],
        filePatterns: ['**/use-cases/**', '**/UseCaseLibrary*'],
        color: '#14B8A6',
        icon: '📚',
      },
      {
        name: 'Test Management',
        description: 'Test cases, test executions, coverage tracking',
        layerIds: [presentationLayer.id, applicationLayer.id, domainLayer.id, infrastructureLayer.id],
        filePatterns: ['**/test-cases/**', '**/test-executions/**', '**/TestCase*'],
        color: '#F59E0B',
        icon: '🧪',
      },
      {
        name: 'Agent Telemetry',
        description: 'Agent runs tracking, frameworks, token costs, performance metrics',
        layerIds: [applicationLayer.id, domainLayer.id, infrastructureLayer.id],
        filePatterns: ['**/runs/**', '**/agent-frameworks/**', '**/agent-metrics/**'],
        color: '#EF4444',
        icon: '📈',
      },
      {
        name: 'Code Quality',
        description: 'Git commits tracking, code metrics, complexity analysis',
        layerIds: [presentationLayer.id, applicationLayer.id, domainLayer.id, infrastructureLayer.id],
        filePatterns: ['**/commits/**', '**/code-metrics/**', '**/CodeQuality*'],
        color: '#6366F1',
        icon: '💎',
      },
      {
        name: 'Real-time Updates',
        description: 'WebSocket gateway for live synchronization',
        layerIds: [presentationLayer.id, applicationLayer.id],
        filePatterns: ['**/websocket/**', '**/*socket*', '**/*gateway*'],
        color: '#EC4899',
        icon: '⚡',
      },
      {
        name: 'MCP Server',
        description: 'Model Context Protocol server with progressive disclosure',
        layerIds: [applicationLayer.id],
        filePatterns: ['**/mcp/**', 'mcp-server/**'],
        color: '#A855F7',
        icon: '🤖',
      },
      {
        name: 'User Management',
        description: 'User profiles, roles, permissions',
        layerIds: [presentationLayer.id, applicationLayer.id, infrastructureLayer.id],
        filePatterns: ['**/users/**', '**/profile/**'],
        color: '#06B6D4',
        icon: '👤',
      },
      {
        name: 'Architecture Management',
        description: 'Layers and Components configuration interface',
        layerIds: [presentationLayer.id, applicationLayer.id, domainLayer.id, infrastructureLayer.id],
        filePatterns: ['**/layers/**', '**/components/**', '**/LayersComponents*'],
        color: '#84CC16',
        icon: '🏗️',
      },
    ];

    for (const comp of components) {
      const component = await createComponent(prisma, {
        projectId: PROJECT_ID,
        ...comp,
        status: 'active',
      });
      console.log(`✓ Created: ${component.name}`);
    }

    console.log('\n✅ Architecture setup complete!\n');

    // List all to verify
    console.log('📊 Verification:\n');
    const layers = await listLayers(prisma, { projectId: PROJECT_ID });
    console.log(`Layers: ${layers.length}`);
    layers.forEach(l => console.log(`  - ${l.icon} ${l.name} (order: ${l.orderIndex})`));

    const allComponents = await listComponents(prisma, { projectId: PROJECT_ID });
    console.log(`\nComponents: ${allComponents.length}`);
    allComponents.forEach(c => console.log(`  - ${c.icon} ${c.name}`));

    console.log(`\n🔗 View in UI: http://localhost:5173/layers-components?projectId=${PROJECT_ID}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

setupArchitecture();
