import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding demo data for Sprint 6...');

  // Create system user
  const systemUser = await prisma.user.upsert({
    where: { email: 'system@aistudio.local' },
    update: {},
    create: {
      email: 'system@aistudio.local',
      name: 'System User',
      password: '$2b$10$YourHashedPasswordHere', // bcrypt hash
      role: 'admin',
    },
  });

  // Create demo project
  const project = await prisma.project.upsert({
    where: { name: 'AI Studio MCP Control Plane' },
    update: {},
    create: {
      name: 'AI Studio MCP Control Plane',
      description: 'Demo project showcasing Sprint 6 features: Kanban board, telemetry, and real-time collaboration',
      status: 'active',
    },
  });

  console.log('✓ Created project:', project.name);

  // Create epics
  const epics = await Promise.all([
    prisma.epic.upsert({
      where: { projectId_key: { projectId: project.id, key: 'EP-1' } },
      update: {},
      create: {
        projectId: project.id,
        key: 'EP-1',
        title: 'Authentication & User Management',
        description: 'Implement secure authentication system',
        priority: 5,
        status: 'in_progress',
      },
    }),
    prisma.epic.upsert({
      where: { projectId_key: { projectId: project.id, key: 'EP-2' } },
      update: {},
      create: {
        projectId: project.id,
        key: 'EP-2',
        title: 'Project Planning Features',
        description: 'Build Kanban board and story management',
        priority: 5,
        status: 'in_progress',
      },
    }),
    prisma.epic.upsert({
      where: { projectId_key: { projectId: project.id, key: 'EP-3' } },
      update: {},
      create: {
        projectId: project.id,
        key: 'EP-3',
        title: 'Telemetry & Metrics',
        description: 'Track agent executions and code commits',
        priority: 4,
        status: 'planning',
      },
    }),
  ]);

  console.log('✓ Created epics:', epics.length);

  // Create layers
  const layers = await Promise.all([
    prisma.layer.create({
      data: {
        projectId: project.id,
        name: 'Frontend',
        description: 'User interface layer',
        techStack: ['React', 'TypeScript', 'Vite', 'TailwindCSS'],
        orderIndex: 1,
        color: '#3B82F6',
        icon: '🌐',
        status: 'active',
      },
    }),
    prisma.layer.create({
      data: {
        projectId: project.id,
        name: 'Backend API',
        description: 'RESTful API layer',
        techStack: ['NestJS', 'TypeScript', 'Node.js'],
        orderIndex: 2,
        color: '#10B981',
        icon: '⚙️',
        status: 'active',
      },
    }),
    prisma.layer.create({
      data: {
        projectId: project.id,
        name: 'Database',
        description: 'Data persistence layer',
        techStack: ['PostgreSQL', 'Prisma'],
        orderIndex: 3,
        color: '#8B5CF6',
        icon: '🗄️',
        status: 'active',
      },
    }),
    prisma.layer.create({
      data: {
        projectId: project.id,
        name: 'Infrastructure',
        description: 'DevOps and deployment',
        techStack: ['Docker', 'Docker Compose', 'Caddy'],
        orderIndex: 4,
        color: '#F59E0B',
        icon: '🔧',
        status: 'active',
      },
    }),
    prisma.layer.create({
      data: {
        projectId: project.id,
        name: 'Testing',
        description: 'Test automation layer',
        techStack: ['Jest', 'React Testing Library', 'Supertest'],
        orderIndex: 5,
        color: '#EF4444',
        icon: '🧪',
        status: 'active',
      },
    }),
  ]);

  console.log('✓ Created layers:', layers.length);

  // Create components
  const components = await Promise.all([
    prisma.component.create({
      data: {
        projectId: project.id,
        name: 'Authentication',
        description: 'User authentication and authorization',
        ownerId: systemUser.id,
        status: 'active',
        color: '#3B82F6',
        icon: '🔐',
        filePatterns: ['**/auth/**', '**/*auth*'],
        layers: {
          create: [
            { layerId: layers[0].id }, // Frontend
            { layerId: layers[1].id }, // Backend
            { layerId: layers[2].id }, // Database
          ],
        },
      },
    }),
    prisma.component.create({
      data: {
        projectId: project.id,
        name: 'Project Management',
        description: 'Projects, epics, and stories',
        ownerId: systemUser.id,
        status: 'active',
        color: '#10B981',
        icon: '📊',
        filePatterns: ['**/projects/**', '**/stories/**', '**/epics/**'],
        layers: {
          create: [
            { layerId: layers[0].id }, // Frontend
            { layerId: layers[1].id }, // Backend
            { layerId: layers[2].id }, // Database
          ],
        },
      },
    }),
    prisma.component.create({
      data: {
        projectId: project.id,
        name: 'Planning Board',
        description: 'Kanban board and drag-and-drop',
        ownerId: systemUser.id,
        status: 'active',
        color: '#8B5CF6',
        icon: '🎯',
        filePatterns: ['**/planning/**', '**/kanban/**'],
        layers: {
          create: [
            { layerId: layers[0].id }, // Frontend
            { layerId: layers[1].id }, // Backend
          ],
        },
      },
    }),
    prisma.component.create({
      data: {
        projectId: project.id,
        name: 'Telemetry & Metrics',
        description: 'Agent runs and code commits tracking',
        ownerId: systemUser.id,
        status: 'active',
        color: '#F59E0B',
        icon: '📈',
        filePatterns: ['**/telemetry/**', '**/metrics/**', '**/runs/**', '**/commits/**'],
        layers: {
          create: [
            { layerId: layers[1].id }, // Backend
            { layerId: layers[2].id }, // Database
          ],
        },
      },
    }),
    prisma.component.create({
      data: {
        projectId: project.id,
        name: 'Real-time Updates',
        description: 'WebSocket and live data synchronization',
        ownerId: systemUser.id,
        status: 'active',
        color: '#EC4899',
        icon: '⚡',
        filePatterns: ['**/websocket/**', '**/*socket*'],
        layers: {
          create: [
            { layerId: layers[0].id }, // Frontend
            { layerId: layers[1].id }, // Backend
          ],
        },
      },
    }),
    prisma.component.create({
      data: {
        projectId: project.id,
        name: 'User Management',
        description: 'User profiles and settings',
        ownerId: systemUser.id,
        status: 'active',
        color: '#6366F1',
        icon: '👤',
        filePatterns: ['**/users/**', '**/profile/**'],
        layers: {
          create: [
            { layerId: layers[0].id }, // Frontend
            { layerId: layers[1].id }, // Backend
            { layerId: layers[2].id }, // Database
          ],
        },
      },
    }),
  ]);

  console.log('✓ Created components:', components.length);

  // Create framework
  const framework = await prisma.agentFramework.create({
    data: {
      projectId: project.id,
      name: 'Single Agent Framework',
      description: 'Simple single-agent execution framework',
      config: {
        agents: ['ba-agent', 'dev-agent', 'qa-agent'],
        routing: 'sequential',
      },
      active: true,
    },
  });

  // Create stories with various statuses and link to components
  const storyData = [
    // Backlog
    { key: 'ST-1', title: 'Implement password reset flow', status: 'backlog', epicId: epics[0].id, type: 'feature', priority: 4, componentIds: [components[0].id], layerIds: [layers[0].id, layers[1].id] },
    { key: 'ST-2', title: 'Add social login (OAuth)', status: 'backlog', epicId: epics[0].id, type: 'feature', priority: 3, componentIds: [components[0].id], layerIds: [layers[0].id, layers[1].id] },
    { key: 'ST-3', title: 'Fix email verification bug', status: 'backlog', epicId: epics[0].id, type: 'bug', priority: 5, componentIds: [components[0].id], layerIds: [layers[1].id] },

    // Planning
    { key: 'ST-4', title: '2FA authentication', status: 'planning', epicId: epics[0].id, type: 'feature', priority: 4, componentIds: [components[0].id], layerIds: [layers[0].id, layers[1].id, layers[2].id] },
    { key: 'ST-5', title: 'User profile management', status: 'planning', epicId: epics[0].id, type: 'feature', priority: 3, componentIds: [components[5].id], layerIds: [layers[0].id, layers[1].id, layers[2].id] },

    // Analysis
    { key: 'ST-6', title: 'Drag-and-drop Kanban board', status: 'analysis', epicId: epics[1].id, type: 'feature', priority: 5, componentIds: [components[2].id], layerIds: [layers[0].id] },
    { key: 'ST-7', title: 'Story filters and search', status: 'analysis', epicId: epics[1].id, type: 'feature', priority: 4, componentIds: [components[1].id], layerIds: [layers[0].id, layers[1].id] },

    // Architecture
    { key: 'ST-8', title: 'Real-time WebSocket updates', status: 'architecture', epicId: epics[1].id, type: 'feature', priority: 5, componentIds: [components[4].id], layerIds: [layers[0].id, layers[1].id] },

    // Implementation
    { key: 'ST-9', title: 'Story detail drawer', status: 'implementation', epicId: epics[1].id, type: 'feature', priority: 5, componentIds: [components[1].id], layerIds: [layers[0].id] },
    { key: 'ST-10', title: 'Telemetry API endpoints', status: 'implementation', epicId: epics[2].id, type: 'feature', priority: 4, componentIds: [components[3].id], layerIds: [layers[1].id] },
    { key: 'ST-11', title: 'Git post-commit hook', status: 'implementation', epicId: epics[2].id, type: 'feature', priority: 3, componentIds: [components[3].id], layerIds: [layers[3].id] },

    // Review
    { key: 'ST-12', title: 'Story Card component', status: 'review', epicId: epics[1].id, type: 'feature', priority: 4, componentIds: [components[1].id], layerIds: [layers[0].id] },
    { key: 'ST-13', title: 'MCP telemetry tools', status: 'review', epicId: epics[2].id, type: 'feature', priority: 5, componentIds: [components[3].id], layerIds: [layers[1].id] },

    // QA
    { key: 'ST-14', title: 'Runs tracking module', status: 'qa', epicId: epics[2].id, type: 'feature', priority: 4, componentIds: [components[3].id], layerIds: [layers[1].id, layers[2].id] },
    { key: 'ST-15', title: 'Commits tracking module', status: 'qa', epicId: epics[2].id, type: 'feature', priority: 4, componentIds: [components[3].id], layerIds: [layers[1].id, layers[2].id] },

    // Done
    { key: 'ST-16', title: 'Project database schema', status: 'done', epicId: epics[1].id, type: 'feature', priority: 5, componentIds: [components[1].id], layerIds: [layers[2].id] },
    { key: 'ST-17', title: 'Basic authentication', status: 'done', epicId: epics[0].id, type: 'feature', priority: 5, componentIds: [components[0].id], layerIds: [layers[0].id, layers[1].id, layers[2].id] },
    { key: 'ST-18', title: 'REST API scaffolding', status: 'done', epicId: epics[1].id, type: 'feature', priority: 5, componentIds: [components[1].id], layerIds: [layers[1].id] },
  ];

  const stories = await Promise.all(
    storyData.map((data) =>
      prisma.story.create({
        data: {
          projectId: project.id,
          epicId: data.epicId,
          key: data.key,
          title: data.title,
          description: `Demo story for ${data.title}`,
          status: data.status as any,
          type: data.type as any,
          businessComplexity: Math.floor(Math.random() * 5) + 1,
          technicalComplexity: Math.floor(Math.random() * 5) + 1,
          businessImpact: data.priority,
          createdById: systemUser.id,
          assignedFrameworkId: Math.random() > 0.5 ? framework.id : null,
          layers: {
            create: data.layerIds.map(layerId => ({ layerId })),
          },
          components: {
            create: data.componentIds.map(componentId => ({ componentId })),
          },
        },
      })
    )
  );

  console.log('✓ Created stories:', stories.length);

  // Add subtasks to some stories
  for (const story of stories.slice(0, 10)) {
    await prisma.subtask.createMany({
      data: [
        {
          storyId: story.id,
          title: `Backend implementation for ${story.key}`,
          description: 'Implement backend logic',
          status: story.status === 'done' ? 'done' : 'todo',
          layer: 'backend',
          assigneeType: 'agent',
        },
        {
          storyId: story.id,
          title: `Frontend UI for ${story.key}`,
          description: 'Build React components',
          status: story.status === 'done' ? 'done' : 'todo',
          layer: 'frontend',
          assigneeType: 'agent',
        },
        {
          storyId: story.id,
          title: `Tests for ${story.key}`,
          description: 'Write unit and integration tests',
          status: 'todo',
          layer: 'tests',
          assigneeType: 'agent',
        },
      ],
    });
  }

  console.log('✓ Created subtasks');

  // Add commits to completed stories
  for (const story of stories.filter(s => s.status === 'done')) {
    await prisma.commit.create({
      data: {
        hash: `${story.key.toLowerCase()}-${Math.random().toString(36).substring(7)}`,
        projectId: project.id,
        storyId: story.id,
        author: 'Developer <dev@example.com>',
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        message: `${story.key}: Implement ${story.title}`,
        files: {
          create: [
            {
              filePath: `src/features/${story.key.toLowerCase()}.ts`,
              locAdded: Math.floor(Math.random() * 200) + 50,
              locDeleted: Math.floor(Math.random() * 50),
            },
          ],
        },
      },
    });
  }

  console.log('✓ Created commits');

  // Add agent runs to stories
  for (const story of stories.filter(s => ['implementation', 'review', 'qa', 'done'].includes(s.status))) {
    await prisma.run.create({
      data: {
        projectId: project.id,
        storyId: story.id,
        frameworkId: framework.id,
        origin: 'mcp',
        tokensInput: Math.floor(Math.random() * 15000) + 5000,
        tokensOutput: Math.floor(Math.random() * 8000) + 2000,
        startedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        finishedAt: new Date(Date.now() - Math.random() * 6 * 24 * 60 * 60 * 1000),
        success: Math.random() > 0.1,
        iterations: Math.floor(Math.random() * 15) + 5,
        metadata: {
          model: 'claude-sonnet-3.5',
          task: story.title,
        },
      },
    });
  }

  console.log('✓ Created agent runs');

  console.log('\n🎉 Demo data seeded successfully!');
  console.log(`\n📊 Summary:`);
  console.log(`   Project: ${project.name}`);
  console.log(`   Layers: ${layers.length}`);
  console.log(`   Components: ${components.length}`);
  console.log(`   Epics: ${epics.length}`);
  console.log(`   Stories: ${stories.length} (all linked to layers & components)`);
  console.log(`   Framework: ${framework.name}`);
  console.log(`\n🚀 Open http://localhost:5173/planning?projectId=${project.id}`);
}

main()
  .catch((e) => {
    console.error('Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
