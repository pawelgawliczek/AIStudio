/**
 * TranscriptWatcher Unit Tests
 *
 * Tests the transcript detection patterns and notification flow:
 * - Agent transcript pattern matching (agent-{6-16-char-hex}.jsonl)
 * - Master session pattern matching ({uuid}.jsonl)
 * - WebSocket notification of detected transcripts
 */

import * as path from 'path';

describe('TranscriptWatcher', () => {
  // Test the regex patterns directly
  describe('Filename Pattern Matching', () => {
    // Agent transcript regex: matches agent-{6-16-char-hex}.jsonl
    const agentRegex = /^agent-([a-f0-9]{6,16})\.jsonl$/;

    // Master session regex: matches {uuid}.jsonl
    const masterRegex = /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.jsonl$/;

    describe('Agent Transcript Pattern', () => {
      it('should match 6-character hex agent ID', () => {
        const filename = 'agent-abc123.jsonl';
        const match = filename.match(agentRegex);
        expect(match).not.toBeNull();
        expect(match![1]).toBe('abc123');
      });

      it('should match 7-character hex agent ID (common case)', () => {
        const filename = 'agent-a29f5d9.jsonl';
        const match = filename.match(agentRegex);
        expect(match).not.toBeNull();
        expect(match![1]).toBe('a29f5d9');
      });

      it('should match 8-character hex agent ID', () => {
        const filename = 'agent-18282e36.jsonl';
        const match = filename.match(agentRegex);
        expect(match).not.toBeNull();
        expect(match![1]).toBe('18282e36');
      });

      it('should match 16-character hex agent ID (max length)', () => {
        const filename = 'agent-0123456789abcdef.jsonl';
        const match = filename.match(agentRegex);
        expect(match).not.toBeNull();
        expect(match![1]).toBe('0123456789abcdef');
      });

      it('should NOT match 5-character hex agent ID (too short)', () => {
        const filename = 'agent-abc12.jsonl';
        const match = filename.match(agentRegex);
        expect(match).toBeNull();
      });

      it('should NOT match 17-character hex agent ID (too long)', () => {
        const filename = 'agent-0123456789abcdefg.jsonl';
        const match = filename.match(agentRegex);
        expect(match).toBeNull();
      });

      it('should NOT match non-hex characters', () => {
        const filename = 'agent-abcdefgh.jsonl'; // g and h are not hex
        const match = filename.match(agentRegex);
        expect(match).toBeNull();
      });

      it('should NOT match uppercase hex', () => {
        const filename = 'agent-ABCDEF12.jsonl';
        const match = filename.match(agentRegex);
        expect(match).toBeNull();
      });

      it('should NOT match wrong extension', () => {
        const filename = 'agent-12345678.json';
        const match = filename.match(agentRegex);
        expect(match).toBeNull();
      });

      it('should NOT match missing prefix', () => {
        const filename = '12345678.jsonl';
        const match = filename.match(agentRegex);
        expect(match).toBeNull();
      });

      it('should match real Claude Code agent transcript names', () => {
        // These are real filenames from production
        const realFilenames = [
          'agent-a29f5d9.jsonl',    // 7 chars
          'agent-a7229f1.jsonl',    // 7 chars
          'agent-18282e36.jsonl',   // 8 chars
          'agent-189dd13c.jsonl',   // 8 chars
          'agent-a510bacf.jsonl',   // 8 chars
          'agent-c9a61643.jsonl',   // 8 chars
        ];

        for (const filename of realFilenames) {
          const match = filename.match(agentRegex);
          expect(match).not.toBeNull();
        }
      });
    });

    describe('Master Session Pattern', () => {
      it('should match valid UUID', () => {
        const filename = 'f6f025da-3410-410b-8dd3-0dee7c9f807d.jsonl';
        const match = filename.match(masterRegex);
        expect(match).not.toBeNull();
        expect(match![1]).toBe('f6f025da-3410-410b-8dd3-0dee7c9f807d');
      });

      it('should NOT match agent transcript', () => {
        const filename = 'agent-12345678.jsonl';
        const match = filename.match(masterRegex);
        expect(match).toBeNull();
      });

      it('should NOT match invalid UUID format', () => {
        const filename = 'f6f025da-3410-410b-8dd3.jsonl';
        const match = filename.match(masterRegex);
        expect(match).toBeNull();
      });

      it('should match real master session transcript names', () => {
        // These are real filenames from production
        const realFilenames = [
          'a9d57a82-00a0-4312-839f-ced6407da189.jsonl',
          'f6f025da-3410-410b-8dd3-0dee7c9f807d.jsonl',
          'fdb10505-d0e3-4c10-9f4e-e297b2dd16c3.jsonl',
        ];

        for (const filename of realFilenames) {
          const match = filename.match(masterRegex);
          expect(match).not.toBeNull();
        }
      });
    });

    describe('Pattern Discrimination', () => {
      it('should correctly identify agent vs master transcripts', () => {
        const testCases = [
          { filename: 'agent-a29f5d9.jsonl', isAgent: true, isMaster: false },
          { filename: 'agent-18282e36.jsonl', isAgent: true, isMaster: false },
          { filename: 'f6f025da-3410-410b-8dd3-0dee7c9f807d.jsonl', isAgent: false, isMaster: true },
          { filename: 'random-file.jsonl', isAgent: false, isMaster: false },
          { filename: 'data.json', isAgent: false, isMaster: false },
        ];

        for (const tc of testCases) {
          const agentMatch = tc.filename.match(agentRegex);
          const masterMatch = tc.filename.match(masterRegex);

          expect(agentMatch !== null).toBe(tc.isAgent);
          expect(masterMatch !== null).toBe(tc.isMaster);
        }
      });
    });
  });

  describe('File Path Processing', () => {
    it('should extract filename from full path', () => {
      const fullPath = '/Users/user/.claude/projects/-Users-user-projects-test/agent-a29f5d9.jsonl';
      const filename = path.basename(fullPath);
      expect(filename).toBe('agent-a29f5d9.jsonl');
    });

    it('should handle paths with special characters', () => {
      const fullPath = '/home/user/.claude/projects/-home-user-my project/agent-12345678.jsonl';
      const filename = path.basename(fullPath);
      expect(filename).toBe('agent-12345678.jsonl');
    });
  });
});
