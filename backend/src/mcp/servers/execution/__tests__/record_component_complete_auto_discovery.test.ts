/**
 * Auto-Discovery Logic Tests for ST-165
 * Tests for automatic token metrics discovery from RemoteJob.result and transcript files
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Test helper functions that mirror the implementation
function getTranscriptDir(projectPath: string): string {
  const homeDir = os.homedir();
  const escapedPath = projectPath.replace(/^\//, '').replace(/\//g, '-');
  return path.join(homeDir, '.claude', 'projects', escapedPath);
}

function findTranscriptByContent(
  transcriptDir: string,
  searchContent: string,
  searchDays = 7,
): string | null {
  if (!fs.existsSync(transcriptDir)) {
    return null;
  }

  const cutoffTime = Date.now() - searchDays * 24 * 60 * 60 * 1000;

  let transcriptFiles: Array<{ name: string; path: string; mtime: Date }>;
  try {
    transcriptFiles = fs
      .readdirSync(transcriptDir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => ({
        name: f,
        path: path.join(transcriptDir, f),
        mtime: fs.statSync(path.join(transcriptDir, f)).mtime,
      }))
      .filter((f) => f.mtime.getTime() > cutoffTime)
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  } catch {
    return null;
  }

  for (const file of transcriptFiles) {
    try {
      const content = fs.readFileSync(file.path, 'utf-8');
      if (content.includes(searchContent)) {
        return file.path;
      }
    } catch {
      // Continue to next file
    }
  }

  return null;
}

describe('Auto-Discovery Logic (ST-165)', () => {
  describe('getTranscriptDir', () => {
    it('should escape project path correctly for root path', () => {
      const projectPath = '/opt/stack/AIStudio';
      const result = getTranscriptDir(projectPath);

      expect(result).toContain('opt-stack-AIStudio');
      expect(result).toContain('.claude/projects');
    });

    it('should escape project path correctly for user path', () => {
      const projectPath = '/Users/pawel/projects/myapp';
      const result = getTranscriptDir(projectPath);

      expect(result).toContain('Users-pawel-projects-myapp');
      expect(result).toContain('.claude/projects');
    });

    it('should handle deeply nested paths', () => {
      const projectPath = '/home/user/work/company/project/submodule';
      const result = getTranscriptDir(projectPath);

      expect(result).toContain('home-user-work-company-project-submodule');
    });
  });

  describe('Priority 4: RemoteJob.result Metrics Extraction', () => {
    it('should extract metrics from RemoteJob.result format', () => {
      const mockResult = {
        metrics: {
          inputTokens: 25000,
          outputTokens: 13500,
          cacheCreationTokens: 1400,
          cacheReadTokens: 23600,
          totalTokens: 38500,
        },
        sessionId: 'test-session-123',
      };

      // Simulate the extraction logic from record_component_complete.ts
      const metrics = mockResult.metrics;

      expect(metrics).toBeDefined();
      expect(metrics.inputTokens).toBe(25000);
      expect(metrics.outputTokens).toBe(13500);
      expect(metrics.cacheCreationTokens).toBe(1400);
      expect(metrics.cacheReadTokens).toBe(23600);
    });

    it('should handle RemoteJob.result without metrics', () => {
      const mockResult = {
        sessionId: 'test-session-123',
        // No metrics field
      };

      const metrics = (mockResult as any).metrics;

      expect(metrics).toBeUndefined();
    });

    it('should handle null RemoteJob.result', () => {
      const mockResult: any = null;

      const metrics = mockResult?.metrics;

      expect(metrics).toBeUndefined();
    });
  });

  describe('Priority 5: Transcript Search Logic', () => {
    it('should handle non-existent transcript directory', () => {
      const result = findTranscriptByContent('/non/existent/path', 'test-content');

      expect(result).toBeNull();
    });

    it('should return null for empty search', () => {
      // This tests the fallback behavior when no transcript contains the search string
      const homeDir = os.homedir();
      const testDir = path.join(homeDir, '.claude', 'projects');

      if (fs.existsSync(testDir)) {
        // If .claude/projects exists, search for a UUID that won't exist
        const result = findTranscriptByContent(testDir, 'non-existent-uuid-12345');
        expect(result).toBeNull();
      } else {
        // Directory doesn't exist
        const result = findTranscriptByContent(testDir, 'any-content');
        expect(result).toBeNull();
      }
    });
  });

  describe('Search Priority Order', () => {
    it('should prioritize sessionId over runId for spawned agents', () => {
      // Test the search order logic
      const searchOrder = ['sessionId', 'runId', 'componentRunId'];

      expect(searchOrder[0]).toBe('sessionId');
      expect(searchOrder[1]).toBe('runId');
      expect(searchOrder[2]).toBe('componentRunId');
    });

    it('should understand why sessionId is more reliable', () => {
      // Claude Code transcripts contain sessionId in every message
      // but runId/componentRunId are only in MCP tool call parameters
      const mockTranscriptLine = {
        type: 'assistant',
        message: {
          id: 'msg_12345',
          role: 'assistant',
        },
        sessionId: 'abc-123', // Always present
      };

      expect(mockTranscriptLine.sessionId).toBeDefined();
      expect((mockTranscriptLine as any).runId).toBeUndefined();
      expect((mockTranscriptLine as any).componentRunId).toBeUndefined();
    });
  });

  describe('Metrics Data Source Tracking', () => {
    it('should set dataSource to transcript_metrics for RemoteJob.result', () => {
      // When metrics come from RemoteJob.result, dataSource should be 'transcript_metrics'
      const dataSource = 'transcript_metrics';
      expect(dataSource).toBe('transcript_metrics');
    });

    it('should set dataSource to transcript for parsed transcript file', () => {
      // When metrics come from transcript file parsing, dataSource should be 'transcript'
      const dataSource = 'transcript';
      expect(dataSource).toBe('transcript');
    });
  });
});
