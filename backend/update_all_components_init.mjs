import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateComponentInstructions() {
  // Get all components from the workflow
  const components = await prisma.component.findMany({
    where: {
      id: {
        in: [
          '4e76b179-37af-433e-a6cf-c39cf20efbd8', // UI/UX Designer
          '507e2765-c099-4ead-8441-b376f3f8b48e', // Context Explore
          '1ba4319a-196e-4639-ba79-e20e914a6853', // Business Analyst
          '4691b49d-48b8-49e8-afb4-75312ab3b91d', // QA Automation
          '1bf75572-a8fe-429b-98a7-a068486854ca', // Software Architect
          '4b16a6f1-2c2a-4f4e-91c8-132d4ea07548', // Full-Stack Developer
          'dd66f91c-6c9e-4c68-b5ce-b697b83194ca', // DevOps Engineer
        ],
      },
    },
    select: {
      id: true,
      name: true,
      inputInstructions: true,
    },
  });

  console.log(`Found ${components.length} components to update\n`);

  const initConfirmationSection = `

**INITIALIZATION CONFIRMATION (REQUIRED FIRST STEP):**

Before reading story details or starting any work, you MUST confirm you have the required context:

1. Acknowledge the Project ID: 345a29ee-d6ab-477d-8079-c5dda0844d77
2. Acknowledge the Story ID, Story Key, Epic ID (provided by coordinator)
3. List the first 3-5 MCP tools available to you to confirm MCP access

**Example confirmation format:**
"✅ Initialization confirmed:
- Project ID: 345a29ee-d6ab-477d-8079-c5dda0844d77
- Story ID: [storyId]
- Story Key: [storyKey]
- Epic ID: [epicId]
- MCP tools available: [list first few tools]

Now proceeding with [Component Name] work..."

**If you cannot access these fields or MCP tools, STOP and report the error immediately.**

---

**AFTER INITIALIZATION CONFIRMATION, proceed with:**
`;

  for (const component of components) {
    // Add initialization confirmation to the beginning of input instructions
    const updatedInputInstructions = initConfirmationSection + '\n' + component.inputInstructions;

    await prisma.component.update({
      where: { id: component.id },
      data: {
        inputInstructions: updatedInputInstructions,
      },
    });

    console.log(`✅ Updated ${component.name}`);
  }

  console.log(`\n✅ Successfully updated ${components.length} components with initialization confirmation`);
}

updateComponentInstructions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
