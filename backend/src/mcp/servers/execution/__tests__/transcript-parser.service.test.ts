import * as fs from 'fs/promises';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { TranscriptParserService } from '../services/transcript-parser.service';

describe('TranscriptParserService', () => {
  let service: TranscriptParserService;
  const fixturesDir = path.join(__dirname, 'fixtures', 'transcripts');

  beforeAll(async () => {
    // Create fixtures directory if it doesn't exist
    await fs.mkdir(fixturesDir, { recursive: true });

    // Create test fixtures
    await createTestFixtures();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TranscriptParserService],
    }).compile();

    service = module.get<TranscriptParserService>(TranscriptParserService);
  });

  afterAll(async () => {
    // Clean up fixtures
    await fs.rm(fixturesDir, { recursive: true, force: true });
  });

  describe('parseAgentTranscript', () => {
    it('should parse valid single-message transcript', async () => {
      const filePath = path.join(fixturesDir, 'agent-single.jsonl');
      const result = await service.parseAgentTranscript(filePath);

      expect(result).not.toBeNull();
      expect(result?.agentId).toBe('test123');
      expect(result?.sessionId).toBe('parent-session');
      expect(result?.model).toBe('claude-sonnet-4-5-20250929');
      expect(result?.inputTokens).toBe(1000);
      expect(result?.outputTokens).toBe(500);
      expect(result?.cacheCreationTokens).toBe(10000);
      expect(result?.cacheReadTokens).toBe(50000);
      expect(result?.totalTokens).toBe(1500); // input + output
    });

    it('should aggregate multiple messages', async () => {
      const filePath = path.join(fixturesDir, 'agent-multi.jsonl');
      const result = await service.parseAgentTranscript(filePath);

      expect(result).not.toBeNull();
      expect(result?.agentId).toBe('multi123');
      expect(result?.inputTokens).toBe(3000); // 1000 + 800 + 1200
      expect(result?.outputTokens).toBe(1500); // 500 + 300 + 700
      expect(result?.cacheCreationTokens).toBe(25000); // 10000 + 5000 + 10000
      expect(result?.cacheReadTokens).toBe(130000); // 50000 + 40000 + 40000
      expect(result?.totalTokens).toBe(4500); // 3000 + 1500
    });

    it('should handle missing cache fields gracefully', async () => {
      const filePath = path.join(fixturesDir, 'agent-no-cache.jsonl');
      const result = await service.parseAgentTranscript(filePath);

      expect(result).not.toBeNull();
      expect(result?.inputTokens).toBe(1000);
      expect(result?.outputTokens).toBe(500);
      expect(result?.cacheCreationTokens).toBe(0);
      expect(result?.cacheReadTokens).toBe(0);
      expect(result?.totalTokens).toBe(1500);
    });

    it('should return null for file not found', async () => {
      const filePath = path.join(fixturesDir, 'nonexistent.jsonl');
      const result = await service.parseAgentTranscript(filePath);

      expect(result).toBeNull();
    });

    it('should recover from malformed JSON lines', async () => {
      const filePath = path.join(fixturesDir, 'agent-malformed.jsonl');
      const result = await service.parseAgentTranscript(filePath);

      // Should parse valid lines only (line 1 and 3)
      expect(result).not.toBeNull();
      expect(result?.inputTokens).toBe(2000); // 1000 + 1000 (skipping malformed line 2)
      expect(result?.outputTokens).toBe(1000); // 500 + 500
    });

    it('should extract agent ID from filename', async () => {
      const filePath = path.join(fixturesDir, 'agent-abc123.jsonl');
      const result = await service.parseAgentTranscript(filePath);

      expect(result).not.toBeNull();
      expect(result?.agentId).toBe('abc123');
    });

    it('should handle empty transcript file', async () => {
      const filePath = path.join(fixturesDir, 'agent-empty.jsonl');
      const result = await service.parseAgentTranscript(filePath);

      expect(result).toBeNull();
    });

    it('should use model from last message', async () => {
      const filePath = path.join(fixturesDir, 'agent-multi-models.jsonl');
      const result = await service.parseAgentTranscript(filePath);

      expect(result).not.toBeNull();
      expect(result?.model).toBe('claude-sonnet-4-5-20250929'); // From last message
    });

    it('should handle transcript without sessionId', async () => {
      const filePath = path.join(fixturesDir, 'agent-no-session.jsonl');
      const result = await service.parseAgentTranscript(filePath);

      expect(result).not.toBeNull();
      expect(result?.sessionId).toBeNull();
      expect(result?.inputTokens).toBe(1000);
    });
  });
});

/**
 * Create test fixture files
 */
async function createTestFixtures() {
  const fixturesDir = path.join(__dirname, 'fixtures', 'transcripts');

  // Single message transcript
  const single = {
    agentId: 'test123',
    sessionId: 'parent-session',
    message: {
      model: 'claude-sonnet-4-5-20250929',
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 10000,
        cache_read_input_tokens: 50000,
      },
    },
  };
  await fs.writeFile(
    path.join(fixturesDir, 'agent-single.jsonl'),
    JSON.stringify(single) + '\n',
  );

  // Multiple messages transcript
  const multi1 = {
    agentId: 'multi123',
    sessionId: 'parent-session',
    message: {
      model: 'claude-sonnet-4-5-20250929',
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 10000,
        cache_read_input_tokens: 50000,
      },
    },
  };
  const multi2 = {
    agentId: 'multi123',
    sessionId: 'parent-session',
    message: {
      model: 'claude-sonnet-4-5-20250929',
      usage: {
        input_tokens: 800,
        output_tokens: 300,
        cache_creation_input_tokens: 5000,
        cache_read_input_tokens: 40000,
      },
    },
  };
  const multi3 = {
    agentId: 'multi123',
    sessionId: 'parent-session',
    message: {
      model: 'claude-sonnet-4-5-20250929',
      usage: {
        input_tokens: 1200,
        output_tokens: 700,
        cache_creation_input_tokens: 10000,
        cache_read_input_tokens: 40000,
      },
    },
  };
  await fs.writeFile(
    path.join(fixturesDir, 'agent-multi.jsonl'),
    JSON.stringify(multi1) +
      '\n' +
      JSON.stringify(multi2) +
      '\n' +
      JSON.stringify(multi3) +
      '\n',
  );

  // Missing cache fields
  const noCache = {
    agentId: 'nocache',
    sessionId: 'parent-session',
    message: {
      model: 'claude-sonnet-4-5-20250929',
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
      },
    },
  };
  await fs.writeFile(
    path.join(fixturesDir, 'agent-no-cache.jsonl'),
    JSON.stringify(noCache) + '\n',
  );

  // Malformed JSON lines
  const malformed1 = {
    agentId: 'malformed',
    sessionId: 'parent-session',
    message: {
      model: 'claude-sonnet-4-5-20250929',
      usage: { input_tokens: 1000, output_tokens: 500 },
    },
  };
  const malformed3 = {
    agentId: 'malformed',
    sessionId: 'parent-session',
    message: {
      model: 'claude-sonnet-4-5-20250929',
      usage: { input_tokens: 1000, output_tokens: 500 },
    },
  };
  await fs.writeFile(
    path.join(fixturesDir, 'agent-malformed.jsonl'),
    JSON.stringify(malformed1) +
      '\n' +
      '{invalid json here}\n' +
      JSON.stringify(malformed3) +
      '\n',
  );

  // Agent ID extraction test
  const abc = {
    agentId: 'abc123',
    sessionId: 'parent-session',
    message: {
      model: 'claude-sonnet-4-5-20250929',
      usage: { input_tokens: 1000, output_tokens: 500 },
    },
  };
  await fs.writeFile(
    path.join(fixturesDir, 'agent-abc123.jsonl'),
    JSON.stringify(abc) + '\n',
  );

  // Empty file
  await fs.writeFile(path.join(fixturesDir, 'agent-empty.jsonl'), '');

  // Multiple models (use last one)
  const model1 = {
    agentId: 'models',
    sessionId: 'parent-session',
    message: {
      model: 'claude-3-opus-20240229',
      usage: { input_tokens: 1000, output_tokens: 500 },
    },
  };
  const model2 = {
    agentId: 'models',
    sessionId: 'parent-session',
    message: {
      model: 'claude-sonnet-4-5-20250929',
      usage: { input_tokens: 1000, output_tokens: 500 },
    },
  };
  await fs.writeFile(
    path.join(fixturesDir, 'agent-multi-models.jsonl'),
    JSON.stringify(model1) + '\n' + JSON.stringify(model2) + '\n',
  );

  // No session ID
  const noSession = {
    agentId: 'nosession',
    message: {
      model: 'claude-sonnet-4-5-20250929',
      usage: { input_tokens: 1000, output_tokens: 500 },
    },
  };
  await fs.writeFile(
    path.join(fixturesDir, 'agent-no-session.jsonl'),
    JSON.stringify(noSession) + '\n',
  );
}
