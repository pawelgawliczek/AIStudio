/**
 * Tests for CheckpointService
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { CheckpointService } from '../../checkpoint/checkpoint-service';
import { createCheckpoint, RunnerCheckpoint } from '../../types/checkpoint';
import { RunnerConfig } from '../../types/config';

// Mock fs and axios
jest.mock('fs');
jest.mock('axios');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CheckpointService', () => {
  let config: RunnerConfig;
  let service: CheckpointService;
  let testCheckpoint: RunnerCheckpoint;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup test config
    config = {
      limits: {
        maxAgentSpawns: 20,
        maxTokenBudget: 500000,
        maxStateTransitions: 50,
        maxRunDuration: 7200000,
        maxConcurrentRuns: 5,
      },
      agent: {
        maxTurns: 100,
        timeout: 1800000,
        defaultTimeout: 1800000,
      },
      master: {
        maxTurns: 1000,
        idleTimeout: 300000,
      },
      backendUrl: 'http://localhost:3000',
      workingDirectory: '/test/worktree',
      checkpointDir: '/test/checkpoints',
      databaseUrl: 'postgresql://test',
    };

    // Mock fs.existsSync to return false for checkpoint dir initially
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.mkdirSync.mockImplementation(() => undefined);

    service = new CheckpointService(config);

    // Create test checkpoint
    testCheckpoint = createCheckpoint('run-123', 'workflow-456', 'session-789', 'story-101');
    testCheckpoint.currentStateId = 'state-1';
    testCheckpoint.completedStates = ['state-0'];
  });

  describe('Constructor', () => {
    it('should create checkpoint directory if it does not exist', () => {
      mockedFs.existsSync.mockReturnValue(false);

      new CheckpointService(config);

      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
        path.join(config.workingDirectory, '.runner', 'checkpoints'),
        { recursive: true }
      );
    });

    it('should not create directory if it already exists', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.mkdirSync.mockClear();

      new CheckpointService(config);

      expect(mockedFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('save', () => {
    beforeEach(() => {
      // Mock successful API response
      mockedAxios.post.mockResolvedValue({ data: { success: true } });

      // Mock successful file write
      mockedFs.writeFileSync.mockImplementation(() => undefined);
      mockedFs.renameSync.mockImplementation(() => undefined);
    });

    it('should save checkpoint to both database and file', async () => {
      const result = await service.save(testCheckpoint);

      expect(result.success).toBe(true);
      expect(result.dbSaved).toBe(true);
      expect(result.fileSaved).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should update checkpointedAt timestamp', async () => {
      const originalTimestamp = testCheckpoint.checkpointedAt;

      await new Promise(resolve => setTimeout(resolve, 10));
      await service.save(testCheckpoint);

      expect(testCheckpoint.checkpointedAt).not.toBe(originalTimestamp);
    });

    it('should call backend API with correct payload', async () => {
      await service.save(testCheckpoint);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:3000/api/runner/checkpoints',
        {
          runId: testCheckpoint.runId,
          workflowId: testCheckpoint.workflowId,
          storyId: testCheckpoint.storyId,
          checkpointData: testCheckpoint,
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('should write checkpoint to file atomically', async () => {
      await service.save(testCheckpoint);

      const expectedPath = path.join(
        config.workingDirectory,
        '.runner',
        'checkpoints',
        `${testCheckpoint.runId}.checkpoint.json`
      );

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        `${expectedPath}.tmp`,
        JSON.stringify(testCheckpoint, null, 2),
        'utf8'
      );

      expect(mockedFs.renameSync).toHaveBeenCalledWith(`${expectedPath}.tmp`, expectedPath);
    });

    it('should succeed if database save fails but file save succeeds', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Database error'));

      const result = await service.save(testCheckpoint);

      expect(result.success).toBe(true);
      expect(result.dbSaved).toBe(false);
      expect(result.fileSaved).toBe(true);
    });

    it('should succeed if file save fails but database save succeeds', async () => {
      mockedFs.writeFileSync.mockImplementation(() => {
        throw new Error('File write error');
      });

      const result = await service.save(testCheckpoint);

      expect(result.success).toBe(true);
      expect(result.dbSaved).toBe(true);
      expect(result.fileSaved).toBe(false);
    });

    it('should fail if both database and file save fail', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Database error'));
      mockedFs.writeFileSync.mockImplementation(() => {
        throw new Error('File error');
      });

      const result = await service.save(testCheckpoint);

      expect(result.success).toBe(false);
      expect(result.dbSaved).toBe(false);
      expect(result.fileSaved).toBe(false);
      expect(result.error).toBe('Both database and file checkpoint saves failed');
    });
  });

  describe('load', () => {
    it('should load checkpoint from database first', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { checkpointData: testCheckpoint },
      });

      const result = await service.load('run-123');

      expect(result).toEqual(testCheckpoint);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:3000/api/runner/checkpoints/run-123',
        { timeout: 10000 }
      );
    });

    it('should fallback to file if database fails', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Database error'));
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(testCheckpoint));

      const result = await service.load('run-123');

      expect(result).toEqual(testCheckpoint);
    });

    it('should return null if checkpoint not found in database (404)', async () => {
      const error: any = new Error('Not found');
      error.response = { status: 404 };
      mockedAxios.get.mockRejectedValue(error);
      mockedAxios.isAxiosError.mockReturnValue(true);

      mockedFs.existsSync.mockReturnValue(false);

      const result = await service.load('run-123');

      expect(result).toBeNull();
    });

    it('should return null if file does not exist', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Database error'));
      mockedFs.existsSync.mockReturnValue(false);

      const result = await service.load('run-123');

      expect(result).toBeNull();
    });

    it('should validate checkpoint before returning', async () => {
      const invalidCheckpoint = { ...testCheckpoint, version: 999 };

      mockedAxios.get.mockResolvedValue({
        data: { checkpointData: invalidCheckpoint },
      });

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(testCheckpoint));

      const result = await service.load('run-123');

      // Should fallback to file because database checkpoint is invalid
      expect(result).toEqual(testCheckpoint);
    });

    it('should return null if both sources have invalid checkpoints', async () => {
      const invalidCheckpoint = { ...testCheckpoint, version: 999 };

      mockedAxios.get.mockResolvedValue({
        data: { checkpointData: invalidCheckpoint },
      });

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(invalidCheckpoint));

      const result = await service.load('run-123');

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      mockedAxios.delete.mockResolvedValue({ data: { success: true } });
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.unlinkSync.mockImplementation(() => undefined);
    });

    it('should delete from both database and file', async () => {
      await service.delete('run-123');

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        'http://localhost:3000/api/runner/checkpoints/run-123',
        { timeout: 10000 }
      );

      expect(mockedFs.unlinkSync).toHaveBeenCalled();
    });

    it('should not fail if database delete fails', async () => {
      mockedAxios.delete.mockRejectedValue(new Error('Database error'));

      await expect(service.delete('run-123')).resolves.not.toThrow();
    });

    it('should not fail if file delete fails', async () => {
      mockedFs.unlinkSync.mockImplementation(() => {
        throw new Error('File error');
      });

      await expect(service.delete('run-123')).resolves.not.toThrow();
    });

    it('should not attempt to delete file if it does not exist', async () => {
      mockedFs.existsSync.mockReturnValue(false);

      await service.delete('run-123');

      expect(mockedFs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('listCheckpoints', () => {
    it('should return list of checkpoint IDs from files', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue([
        'run-1.checkpoint.json',
        'run-2.checkpoint.json',
        'run-3.checkpoint.json',
        'other-file.txt',
      ] as any);

      const list = service.listCheckpoints();

      expect(list).toEqual(['run-1', 'run-2', 'run-3']);
    });

    it('should return empty array if directory does not exist', () => {
      mockedFs.existsSync.mockReturnValue(false);

      const list = service.listCheckpoints();

      expect(list).toEqual([]);
    });

    it('should filter out non-checkpoint files', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue([
        'run-1.checkpoint.json',
        'readme.md',
        '.gitignore',
        'temp.tmp',
      ] as any);

      const list = service.listCheckpoints();

      expect(list).toEqual(['run-1']);
    });
  });

  describe('getCheckpointAge', () => {
    it('should return age in milliseconds', async () => {
      const pastDate = new Date(Date.now() - 60000); // 1 minute ago
      const checkpoint = { ...testCheckpoint, checkpointedAt: pastDate.toISOString() };

      mockedAxios.get.mockResolvedValue({
        data: { checkpointData: checkpoint },
      });

      const age = await service.getCheckpointAge('run-123');

      expect(age).toBeGreaterThanOrEqual(60000);
      expect(age).toBeLessThan(70000); // Allow 10s tolerance
    });

    it('should return null if checkpoint not found', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Not found'));
      mockedFs.existsSync.mockReturnValue(false);

      const age = await service.getCheckpointAge('run-123');

      expect(age).toBeNull();
    });
  });

  describe('cleanupOldCheckpoints', () => {
    it('should delete checkpoints older than maxAge', async () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

      const oldCheckpoint = { ...testCheckpoint, runId: 'old-run', checkpointedAt: oldDate.toISOString() };
      const recentCheckpoint = { ...testCheckpoint, runId: 'recent-run', checkpointedAt: recentDate.toISOString() };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue([
        'old-run.checkpoint.json',
        'recent-run.checkpoint.json',
      ] as any);

      // Mock load to return different checkpoints
      mockedAxios.get.mockImplementation((url: string) => {
        if (url.includes('old-run')) {
          return Promise.resolve({ data: { checkpointData: oldCheckpoint } });
        }
        return Promise.resolve({ data: { checkpointData: recentCheckpoint } });
      });

      mockedAxios.delete.mockResolvedValue({ data: { success: true } });
      mockedFs.unlinkSync.mockImplementation(() => undefined);

      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      const cleaned = await service.cleanupOldCheckpoints(maxAge);

      expect(cleaned).toBe(1);
      expect(mockedAxios.delete).toHaveBeenCalledTimes(1);
      expect(mockedAxios.delete).toHaveBeenCalledWith(
        expect.stringContaining('old-run'),
        expect.any(Object)
      );
    });

    it('should not delete recent checkpoints', async () => {
      const recentCheckpoint = {
        ...testCheckpoint,
        checkpointedAt: new Date(Date.now() - 1000).toISOString(),
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue(['recent-run.checkpoint.json'] as any);

      mockedAxios.get.mockResolvedValue({
        data: { checkpointData: recentCheckpoint },
      });

      const maxAge = 7 * 24 * 60 * 60 * 1000;
      const cleaned = await service.cleanupOldCheckpoints(maxAge);

      expect(cleaned).toBe(0);
      expect(mockedAxios.delete).not.toHaveBeenCalled();
    });

    it('should use default maxAge of 7 days', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue([] as any);

      const cleaned = await service.cleanupOldCheckpoints();

      expect(cleaned).toBe(0);
    });
  });
});
