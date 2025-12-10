/**
 * Tests for BackendClient transcript registration methods
 * ST-189: Docker Runner Transcript Registration
 */

import axios from 'axios';
import { BackendClient } from '../../api/backend-client';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('BackendClient - Transcript Registration (ST-189)', () => {
  let client: BackendClient;
  const baseUrl = 'http://localhost:3000';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock axios.create to return mocked client
    const mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn((fn) => fn({ method: 'GET', url: '/test' })),
        },
        response: {
          use: jest.fn((successFn) => successFn),
        },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    // Type predicate functions need special handling
    (mockedAxios as any).isAxiosError = jest.fn().mockReturnValue(false);

    client = new BackendClient(baseUrl);
  });

  describe('registerMasterTranscript', () => {
    it('should successfully register master transcript', async () => {
      const payload = {
        workflowRunId: 'run-123',
        sessionId: 'master-session-456',
        transcriptPath: '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/master-session-456.jsonl',
      };

      const mockResponse = {
        data: {
          success: true,
          type: 'master',
          transcriptPath: payload.transcriptPath,
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await client.registerMasterTranscript(payload);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/api/runner/workflow-runs/${payload.workflowRunId}/transcripts`,
        {
          type: 'master',
          transcriptPath: payload.transcriptPath,
          sessionId: payload.sessionId,
        }
      );
    });

    it('should handle successful response without success field', async () => {
      const payload = {
        workflowRunId: 'run-123',
        sessionId: 'master-session-456',
        transcriptPath: '/path/to/transcript.jsonl',
      };

      const mockResponse = {
        data: {
          type: 'master',
          transcriptPath: payload.transcriptPath,
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await client.registerMasterTranscript(payload);

      expect(result.success).toBe(true);
    });

    it('should handle HTTP errors gracefully', async () => {
      const payload = {
        workflowRunId: 'run-123',
        sessionId: 'master-session-456',
        transcriptPath: '/path/to/transcript.jsonl',
      };

      const mockError = new Error('Network error');
      (mockError as any).isAxiosError = true;

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock).mockRejectedValue(mockError);

      mockedAxios.isAxiosError.mockReturnValue(true);

      const result = await client.registerMasterTranscript(payload);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle 404 errors', async () => {
      const payload = {
        workflowRunId: 'non-existent-run',
        sessionId: 'master-session-456',
        transcriptPath: '/path/to/transcript.jsonl',
      };

      const mockError: any = new Error('Not Found');
      mockError.response = { status: 404 };
      mockError.isAxiosError = true;

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock).mockRejectedValue(mockError);

      mockedAxios.isAxiosError.mockReturnValue(true);

      const result = await client.registerMasterTranscript(payload);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not Found');
    });

    it('should handle 500 server errors', async () => {
      const payload = {
        workflowRunId: 'run-123',
        sessionId: 'master-session-456',
        transcriptPath: '/path/to/transcript.jsonl',
      };

      const mockError: any = new Error('Internal Server Error');
      mockError.response = { status: 500 };
      mockError.isAxiosError = true;

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock).mockRejectedValue(mockError);

      mockedAxios.isAxiosError.mockReturnValue(true);

      const result = await client.registerMasterTranscript(payload);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal Server Error');
    });

    it('should handle non-axios errors', async () => {
      const payload = {
        workflowRunId: 'run-123',
        sessionId: 'master-session-456',
        transcriptPath: '/path/to/transcript.jsonl',
      };

      const mockError = new Error('Unknown error');

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock).mockRejectedValue(mockError);

      mockedAxios.isAxiosError.mockReturnValue(false);

      const result = await client.registerMasterTranscript(payload);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should log warnings on failure', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const payload = {
        workflowRunId: 'run-123',
        sessionId: 'master-session-456',
        transcriptPath: '/path/to/transcript.jsonl',
      };

      const mockError = new Error('Registration failed');

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock).mockRejectedValue(mockError);

      mockedAxios.isAxiosError.mockReturnValue(true);

      await client.registerMasterTranscript(payload);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[BackendClient] Master transcript registration failed:',
        'Registration failed'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('registerAgentTranscript', () => {
    it('should successfully register agent transcript', async () => {
      const payload = {
        workflowRunId: 'run-123',
        componentId: 'component-456',
        agentId: 'agent-789',
        transcriptPath: '/opt/stack/AIStudio/.claude/projects/-opt-stack-AIStudio/agent-comp456-1234567890.jsonl',
      };

      const mockResponse = {
        data: {
          success: true,
          type: 'agent',
          transcriptPath: payload.transcriptPath,
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await client.registerAgentTranscript(payload);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/api/runner/workflow-runs/${payload.workflowRunId}/transcripts`,
        {
          type: 'agent',
          componentId: payload.componentId,
          agentId: payload.agentId,
          transcriptPath: payload.transcriptPath,
        }
      );
    });

    it('should handle successful response without success field', async () => {
      const payload = {
        workflowRunId: 'run-123',
        componentId: 'component-456',
        agentId: 'agent-789',
        transcriptPath: '/path/to/agent-transcript.jsonl',
      };

      const mockResponse = {
        data: {
          type: 'agent',
          transcriptPath: payload.transcriptPath,
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await client.registerAgentTranscript(payload);

      expect(result.success).toBe(true);
    });

    it('should handle HTTP errors gracefully', async () => {
      const payload = {
        workflowRunId: 'run-123',
        componentId: 'component-456',
        agentId: 'agent-789',
        transcriptPath: '/path/to/agent-transcript.jsonl',
      };

      const mockError = new Error('Network error');
      (mockError as any).isAxiosError = true;

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock).mockRejectedValue(mockError);

      mockedAxios.isAxiosError.mockReturnValue(true);

      const result = await client.registerAgentTranscript(payload);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle validation errors from backend', async () => {
      const payload = {
        workflowRunId: 'run-123',
        componentId: 'component-456',
        agentId: 'agent-789',
        transcriptPath: '../../../etc/passwd',
      };

      const mockError: any = new Error('Invalid path: traversal not allowed');
      mockError.response = { status: 400, data: { error: 'Invalid path: traversal not allowed' } };
      mockError.isAxiosError = true;

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock).mockRejectedValue(mockError);

      mockedAxios.isAxiosError.mockReturnValue(true);

      const result = await client.registerAgentTranscript(payload);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid path');
    });

    it('should log warnings on failure', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const payload = {
        workflowRunId: 'run-123',
        componentId: 'component-456',
        agentId: 'agent-789',
        transcriptPath: '/path/to/agent-transcript.jsonl',
      };

      const mockError = new Error('Registration failed');

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock).mockRejectedValue(mockError);

      mockedAxios.isAxiosError.mockReturnValue(true);

      await client.registerAgentTranscript(payload);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[BackendClient] Agent transcript registration failed:',
        'Registration failed'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle empty error messages', async () => {
      const payload = {
        workflowRunId: 'run-123',
        sessionId: 'master-session-456',
        transcriptPath: '/path/to/transcript.jsonl',
      };

      const mockError = new Error('');
      (mockError as any).isAxiosError = true;

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock).mockRejectedValue(mockError);

      mockedAxios.isAxiosError.mockReturnValue(true);

      const result = await client.registerMasterTranscript(payload);

      expect(result.success).toBe(false);
      expect(result.error).toBe('');
    });

    it('should handle errors without message property', async () => {
      const payload = {
        workflowRunId: 'run-123',
        sessionId: 'master-session-456',
        transcriptPath: '/path/to/transcript.jsonl',
      };

      const mockError: any = {};
      mockError.isAxiosError = true;

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock).mockRejectedValue(mockError);

      mockedAxios.isAxiosError.mockReturnValue(true);

      const result = await client.registerMasterTranscript(payload);

      expect(result.success).toBe(false);
    });

    it('should handle timeout errors', async () => {
      const payload = {
        workflowRunId: 'run-123',
        componentId: 'component-456',
        agentId: 'agent-789',
        transcriptPath: '/path/to/transcript.jsonl',
      };

      const mockError: any = new Error('timeout of 30000ms exceeded');
      mockError.code = 'ECONNABORTED';
      mockError.isAxiosError = true;

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock).mockRejectedValue(mockError);

      mockedAxios.isAxiosError.mockReturnValue(true);

      const result = await client.registerAgentTranscript(payload);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('Concurrent Registrations', () => {
    it('should handle multiple master transcript registrations in parallel', async () => {
      const payloads = [
        {
          workflowRunId: 'run-1',
          sessionId: 'session-1',
          transcriptPath: '/path/to/transcript1.jsonl',
        },
        {
          workflowRunId: 'run-2',
          sessionId: 'session-2',
          transcriptPath: '/path/to/transcript2.jsonl',
        },
        {
          workflowRunId: 'run-3',
          sessionId: 'session-3',
          transcriptPath: '/path/to/transcript3.jsonl',
        },
      ];

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock).mockResolvedValue({
        data: { success: true },
      });

      const results = await Promise.all(
        payloads.map((payload) => client.registerMasterTranscript(payload))
      );

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure in parallel registrations', async () => {
      const payloads = [
        {
          workflowRunId: 'run-success',
          componentId: 'comp-1',
          agentId: 'agent-1',
          transcriptPath: '/path/to/success.jsonl',
        },
        {
          workflowRunId: 'run-failure',
          componentId: 'comp-2',
          agentId: 'agent-2',
          transcriptPath: '/path/to/failure.jsonl',
        },
      ];

      const mockAxiosInstance = mockedAxios.create();
      (mockAxiosInstance.post as jest.Mock)
        .mockResolvedValueOnce({ data: { success: true } })
        .mockRejectedValueOnce(new Error('Registration failed'));

      mockedAxios.isAxiosError.mockReturnValue(true);

      const results = await Promise.all(
        payloads.map((payload) => client.registerAgentTranscript(payload))
      );

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });
});
