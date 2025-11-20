import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateCoordinatorInstructions() {
  const coordinatorId = '0f37e71a-b69c-4ff8-a3c1-3ea83d098181';

  const currentCoordinator = await prisma.coordinatorAgent.findUnique({
    where: { id: coordinatorId },
    select: { coordinatorInstructions: true },
  });

  if (!currentCoordinator) {
    console.error('❌ Coordinator not found');
    return;
  }

  // Add new section about agent initialization
  const agentInitSection = `

STEP 3.4: AGENT INITIALIZATION - CRITICAL CONTEXT LOADING

🎯 CRITICAL: When spawning component agents with the Task tool, agents MUST have project context IMMEDIATELY to use MCP tools.

**THE PROBLEM WE'RE SOLVING:**
- MCP tools require projectId parameter
- Agents don't have this context when first spawned
- Agents try to pull it, fail, and move on - losing access to critical MCP tools
- This causes silent failures and wasted tokens

**THE SOLUTION:**

1. **Provide Initialization Context in Task Prompt:**

When constructing the Task prompt for a component agent, ALWAYS include this initialization section FIRST:

---
## INITIALIZATION - READ THIS FIRST

**Project Context (REQUIRED for MCP tools):**
- Project ID: 345a29ee-d6ab-477d-8079-c5dda0844d77
- Project Name: AI Studio
- Repository: https://github.com/pawelgawliczek/AIStudio

**Story Context:**
- Story ID: [storyId]
- Story Key: [storyKey]
- Epic ID: [epicId]
- Epic Key: [epicKey]

**Workflow Context:**
- Workflow Run ID: [runId]
- Component Run ID: [componentRunId]

**CRITICAL: Before starting ANY work, you MUST:**

1. Acknowledge that you have loaded the following required fields:
   - ✅ Project ID: 345a29ee-d6ab-477d-8079-c5dda0844d77
   - ✅ Story ID: [storyId]
   - ✅ Story Key: [storyKey]

2. Confirm you can access MCP tools by listing the first few tools available to you

3. ONLY AFTER CONFIRMATION, proceed with the component instructions below

**If you cannot confirm the above, STOP and report the error immediately.**

---

2. **Verify Agent Initialization:**

After spawning the agent with the Task tool, check its first response. The agent MUST:
- Explicitly acknowledge the Project ID, Story ID, and other context fields
- Confirm MCP tool access (list or mention available MCP tools)
- ONLY then proceed with component work

**Example of CORRECT agent initialization response:**
"✅ Initialization confirmed:
- Project ID: 345a29ee-d6ab-477d-8079-c5dda0844d77
- Story ID: abc-123
- Story Key: ST-25
- MCP tools available: get_story, update_story, search_use_cases, find_related_use_cases...

Now proceeding with Context Explore component..."

**Example of INCORRECT response (MUST STOP and retry):**
"Starting context exploration..."  ← No confirmation = STOP!

3. **Handle Initialization Failures:**

If the agent does NOT confirm initialization:
- STOP the component immediately
- Do NOT call record_component_complete
- Report error: "Agent failed to initialize - missing project context"
- Retry component spawn with clearer initialization instructions
- If retry fails, mark component as failed with errorMessage

4. **Why This Matters:**
- Without project ID, ALL MCP tool calls will fail silently
- Agent will waste tokens trying alternative approaches
- Context exploration, BA analysis, architecture review all depend on MCP tools
- Workflow will appear to succeed but produce no useful output
- Cost increases without value

**ALWAYS VERIFY INITIALIZATION BEFORE PROCEEDING!**
`;

  // Insert the agent initialization section after STEP 3.5 (metrics extraction)
  const updatedInstructions = currentCoordinator.coordinatorInstructions.replace(
    'COORDINATOR RESPONSIBILITIES FOR COMPONENT EXECUTION:',
    agentInitSection + '\n\nCOORDINATOR RESPONSIBILITIES FOR COMPONENT EXECUTION:'
  );

  const result = await prisma.coordinatorAgent.update({
    where: { id: coordinatorId },
    data: {
      coordinatorInstructions: updatedInstructions,
    },
  });

  console.log('✅ Updated coordinator instructions with agent initialization protocol');
  console.log(`Coordinator ID: ${result.id}`);
  console.log(`Updated at: ${result.updatedAt}`);
}

updateCoordinatorInstructions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
