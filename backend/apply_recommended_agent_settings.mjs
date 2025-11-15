import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Recommended settings by agent type
const RECOMMENDED_SETTINGS = {
  // Coordinator
  '0f37e71a-b69c-4ff8-a3c1-3ea83d098181': {
    name: 'Software Development PM (Coordinator)',
    config: {
      modelId: 'claude-sonnet-4-5-20250929',
      temperature: 0.3,
      maxInputTokens: 25000,
      maxOutputTokens: 4000,
      timeout: 300000,
      maxRetries: 3,
    },
  },
};

const COMPONENT_SETTINGS = {
  // Context Explore
  '507e2765-c099-4ead-8441-b376f3f8b48e': {
    name: 'Context Explore',
    config: {
      modelId: 'claude-sonnet-4-5-20250929',
      temperature: 0.2,
      maxInputTokens: 50000,
      maxOutputTokens: 6000,
      timeout: 600000,
      maxRetries: 2,
    },
  },
  // Business Analyst
  '1ba4319a-196e-4639-ba79-e20e914a6853': {
    name: 'Business Analyst',
    config: {
      modelId: 'claude-sonnet-4-5-20250929',
      temperature: 0.5,
      maxInputTokens: 30000,
      maxOutputTokens: 8000,
      timeout: 400000,
      maxRetries: 3,
    },
  },
  // UI/UX Designer
  '4e76b179-37af-433e-a6cf-c39cf20efbd8': {
    name: 'UI/UX Designer',
    config: {
      modelId: 'claude-sonnet-4-5-20250929',
      temperature: 0.7,
      maxInputTokens: 25000,
      maxOutputTokens: 7000,
      timeout: 400000,
      maxRetries: 2,
    },
  },
  // Software Architect
  '1bf75572-a8fe-429b-98a7-a068486854ca': {
    name: 'Software Architect',
    config: {
      modelId: 'claude-sonnet-4-5-20250929',
      temperature: 0.3,
      maxInputTokens: 40000,
      maxOutputTokens: 8000,
      timeout: 500000,
      maxRetries: 3,
    },
  },
  // Full-Stack Developer
  '4b16a6f1-2c2a-4f4e-91c8-132d4ea07548': {
    name: 'Full-Stack Developer',
    config: {
      modelId: 'claude-sonnet-4-5-20250929',
      temperature: 0.2,
      maxInputTokens: 60000,
      maxOutputTokens: 16000,
      timeout: 900000,
      maxRetries: 4,
    },
  },
  // QA Automation
  '4691b49d-48b8-49e8-afb4-75312ab3b91d': {
    name: 'QA Automation',
    config: {
      modelId: 'claude-sonnet-4-5-20250929',
      temperature: 0.2,
      maxInputTokens: 35000,
      maxOutputTokens: 12000,
      timeout: 600000,
      maxRetries: 3,
    },
  },
  // DevOps Engineer
  'dd66f91c-6c9e-4c68-b5ce-b697b83194ca': {
    name: 'DevOps Engineer',
    config: {
      modelId: 'claude-sonnet-4-5-20250929',
      temperature: 0.1,
      maxInputTokens: 30000,
      maxOutputTokens: 6000,
      timeout: 900000,
      maxRetries: 5,
    },
  },
};

async function applyRecommendedSettings() {
  console.log('🔧 Applying recommended agent settings...\n');

  // Update coordinator
  console.log('=== COORDINATOR ===');
  for (const [id, { name, config }] of Object.entries(RECOMMENDED_SETTINGS)) {
    try {
      await prisma.coordinatorAgent.update({
        where: { id },
        data: { config },
      });
      console.log(`✅ ${name}`);
      console.log(`   Temperature: ${config.temperature}`);
      console.log(`   Input: ${config.maxInputTokens} | Output: ${config.maxOutputTokens}`);
      console.log(`   Timeout: ${config.timeout / 1000}s | Retries: ${config.maxRetries}\n`);
    } catch (error) {
      console.error(`❌ Failed to update ${name}:`, error.message);
    }
  }

  // Update components
  console.log('=== COMPONENTS ===');
  for (const [id, { name, config }] of Object.entries(COMPONENT_SETTINGS)) {
    try {
      await prisma.component.update({
        where: { id },
        data: { config },
      });
      console.log(`✅ ${name}`);
      console.log(`   Temperature: ${config.temperature}`);
      console.log(`   Input: ${config.maxInputTokens} | Output: ${config.maxOutputTokens}`);
      console.log(`   Timeout: ${config.timeout / 1000}s | Retries: ${config.maxRetries}\n`);
    } catch (error) {
      console.error(`❌ Failed to update ${name}:`, error.message);
    }
  }

  console.log('✅ Recommended settings applied successfully!');
  console.log('\n📊 Summary:');
  console.log('- Coordinator: 1 updated');
  console.log('- Components: 7 updated');
  console.log('\n📖 See docs/RECOMMENDED_AGENT_SETTINGS.md for details');
}

applyRecommendedSettings()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
