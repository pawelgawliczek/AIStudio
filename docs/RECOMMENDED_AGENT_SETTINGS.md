# Recommended Agent Configuration Settings

This guide provides optimized configuration settings for each agent type in the workflow based on their specific roles and requirements.

## Configuration Parameters Explained

### Temperature (0.0 - 1.0)
- **0.0-0.2**: Very deterministic, focused, precise - for critical technical work
- **0.3-0.4**: Mostly consistent with slight variation - for most coding tasks
- **0.5-0.6**: Balanced creativity and consistency - for design and architecture
- **0.7-1.0**: Creative and varied - for brainstorming and exploration

### MaxInputTokens
- How much context the agent can read
- Higher = better understanding but higher cost
- Consider the typical size of files/context the agent needs

### MaxOutputTokens
- Maximum length of agent responses
- Code generation needs more
- Analysis/planning needs moderate amounts

### Timeout (milliseconds)
- How long before the operation times out
- Complex tasks (implementation, exploration) need more time
- Simple tasks can use shorter timeouts

### MaxRetries
- How many times to retry on failure
- Critical operations (deployment, implementation) need more retries
- Analysis tasks can use fewer retries

---

## Recommended Settings by Agent Type

### 1. Coordinator/PM (Software Development PM)

```json
{
  "modelId": "claude-sonnet-4-5-20250929",
  "temperature": 0.3,
  "maxInputTokens": 25000,
  "maxOutputTokens": 4000,
  "timeout": 300000,
  "maxRetries": 3
}
```

**Rationale:**
- Low temperature for consistent decision-making
- High input tokens to understand full workflow context
- Moderate output for orchestration instructions
- Standard timeout and retries

---

### 2. Context Explore

```json
{
  "modelId": "claude-sonnet-4-5-20250929",
  "temperature": 0.2,
  "maxInputTokens": 50000,
  "maxOutputTokens": 6000,
  "timeout": 600000,
  "maxRetries": 2
}
```

**Rationale:**
- **Very low temperature (0.2)**: Needs precision to find exactly the right files
- **Very high input tokens (50k)**: Reads many files, code, and documentation
- **High output (6k)**: Comprehensive context reports with file excerpts
- **Long timeout (10 min)**: File exploration can take time
- **Fewer retries (2)**: Exploration is not critical-path, can fail gracefully

---

### 3. Business Analyst

```json
{
  "modelId": "claude-sonnet-4-5-20250929",
  "temperature": 0.5,
  "maxInputTokens": 30000,
  "maxOutputTokens": 8000,
  "timeout": 400000,
  "maxRetries": 3
}
```

**Rationale:**
- **Moderate temperature (0.5)**: Balance between creativity (requirements) and precision
- **High input tokens (30k)**: Reads story, context, use cases, related stories
- **High output (8k)**: Detailed requirements, acceptance criteria, test cases
- **Moderate timeout (6.5 min)**: Analysis takes time
- **Standard retries (3)**: Important but not critical

---

### 4. UI/UX Designer

```json
{
  "modelId": "claude-sonnet-4-5-20250929",
  "temperature": 0.7,
  "maxInputTokens": 25000,
  "maxOutputTokens": 7000,
  "timeout": 400000,
  "maxRetries": 2
}
```

**Rationale:**
- **Higher temperature (0.7)**: Encourages creative design solutions
- **Moderate input tokens (25k)**: Reads requirements, existing UI patterns
- **High output (7k)**: Detailed UI/UX specs, component hierarchy, wireframes
- **Moderate timeout (6.5 min)**: Design work takes time
- **Fewer retries (2)**: Creative work, not critical path

---

### 5. Software Architect

```json
{
  "modelId": "claude-sonnet-4-5-20250929",
  "temperature": 0.3,
  "maxInputTokens": 40000,
  "maxOutputTokens": 8000,
  "timeout": 500000,
  "maxRetries": 3
}
```

**Rationale:**
- **Low temperature (0.3)**: Technical decisions need consistency
- **Very high input tokens (40k)**: Reads context, requirements, existing architecture, code
- **High output (8k)**: Detailed architecture docs, API specs, schema changes
- **Long timeout (8.3 min)**: Architecture analysis is thorough
- **Standard retries (3)**: Important decisions

---

### 6. Full-Stack Developer

```json
{
  "modelId": "claude-sonnet-4-5-20250929",
  "temperature": 0.2,
  "maxInputTokens": 60000,
  "maxOutputTokens": 16000,
  "timeout": 900000,
  "maxRetries": 4
}
```

**Rationale:**
- **Very low temperature (0.2)**: Code must be precise and correct
- **Maximum input tokens (60k)**: Reads architecture, existing code, tests, requirements
- **Maximum output (16k)**: Writes lots of code (backend + frontend + tests)
- **Very long timeout (15 min)**: Implementation is the longest task
- **More retries (4)**: Code correctness is critical

---

### 7. QA Automation

```json
{
  "modelId": "claude-sonnet-4-5-20250929",
  "temperature": 0.2,
  "maxInputTokens": 35000,
  "maxOutputTokens": 12000,
  "timeout": 600000,
  "maxRetries": 3
}
```

**Rationale:**
- **Very low temperature (0.2)**: Test code must be precise
- **High input tokens (35k)**: Reads requirements, implementation, existing tests
- **Very high output (12k)**: Writes comprehensive E2E tests with multiple scenarios
- **Long timeout (10 min)**: Test writing takes time
- **Standard retries (3)**: Important for quality

---

### 8. DevOps Engineer

```json
{
  "modelId": "claude-sonnet-4-5-20250929",
  "temperature": 0.1,
  "maxInputTokens": 30000,
  "maxOutputTokens": 6000,
  "timeout": 900000,
  "maxRetries": 5
}
```

**Rationale:**
- **Lowest temperature (0.1)**: Deployment scripts must be exact, no variation
- **High input tokens (30k)**: Reads implementation, tests, deployment configs
- **Moderate output (6k)**: Deployment scripts, verification steps
- **Very long timeout (15 min)**: Builds and deployments can be slow
- **Maximum retries (5)**: Deployments can fail for transient reasons (network, etc.)

---

## Summary Table

| Agent Type | Temp | MaxInput | MaxOutput | Timeout | Retries | Priority |
|------------|------|----------|-----------|---------|---------|----------|
| Coordinator | 0.3 | 25k | 4k | 5m | 3 | High |
| Context Explore | 0.2 | 50k | 6k | 10m | 2 | Medium |
| Business Analyst | 0.5 | 30k | 8k | 6.5m | 3 | High |
| UI/UX Designer | 0.7 | 25k | 7k | 6.5m | 2 | Medium |
| Software Architect | 0.3 | 40k | 8k | 8.3m | 3 | High |
| Full-Stack Developer | 0.2 | 60k | 16k | 15m | 4 | Critical |
| QA Automation | 0.2 | 35k | 12k | 10m | 3 | High |
| DevOps Engineer | 0.1 | 30k | 6k | 15m | 5 | Critical |

---

## Cost Optimization Tips

### For Lower Budget Projects
- Reduce maxInputTokens by 20-30%
- Use `haiku` model for Context Explore and UI/UX Designer
- Reduce timeout for non-critical agents

### For Higher Quality Needs
- Increase maxInputTokens for Developer and Architect
- Use `opus` model for Software Architect on complex stories
- Increase retries for critical agents

### Model Selection by Agent
- **Haiku candidates**: Context Explore, UI/UX Designer (faster, cheaper)
- **Sonnet (default)**: All agents for balanced performance
- **Opus candidates**: Software Architect, Full-Stack Developer (complex stories only)

---

## How to Apply These Settings

Use the `update_component` MCP tool:

```javascript
// Example: Update Full-Stack Developer with recommended settings
mcp__vibestudio__update_component({
  componentId: "4b16a6f1-2c2a-4f4e-91c8-132d4ea07548",
  config: {
    modelId: "claude-sonnet-4-5-20250929",
    temperature: 0.2,
    maxInputTokens: 60000,
    maxOutputTokens: 16000,
    timeout: 900000,
    maxRetries: 4
  }
})
```

---

## Notes

- These are **starting recommendations** - adjust based on your specific needs
- Monitor actual token usage and adjust maxInputTokens/maxOutputTokens accordingly
- Consider story complexity when choosing timeout values
- Critical agents (Developer, DevOps) should have higher retries
- Creative agents (Designer, BA) can have higher temperature
- Technical agents (Developer, Architect, DevOps) need lower temperature
