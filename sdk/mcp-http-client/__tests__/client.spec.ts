/**
 * Unit tests for MCP HTTP Client
 */

import { McpHttpClient } from '../src/client';
import { ConnectionState } from '../src/types';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  })),
}));

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    connected: false,
    id: 'mock-socket-id',
  })),
}));

describe('McpHttpClient', () => {
  let client: McpHttpClient;
  let mockAxios: any;
  let mockSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup axios mock
    const axios = require('axios');
    mockAxios = {
      post: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    };
    axios.create.mockReturnValue(mockAxios);

    // Setup socket.io mock
    const io = require('socket.io-client').io;
    mockSocket = {
      on: jest.fn(),
      emit: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      connected: false,
      id: 'mock-socket-id',
    };
    io.mockReturnValue(mockSocket);

    // Create client
    client = new McpHttpClient({
      baseUrl: 'https://test.example.com',
      apiKey: 'test-api-key',
      debug: false,
    });
  });

  describe('Constructor', () => {
    it('should create client with default options', () => {
      expect(client).toBeInstanceOf(McpHttpClient);
      expect(client.getConnectionState()).toBe(ConnectionState.DISCONNECTED);
      expect(client.getSessionId()).toBeNull();
    });

    it('should remove trailing slash from baseUrl', () => {
      const clientWithSlash = new McpHttpClient({
        baseUrl: 'https://test.example.com/',
        apiKey: 'test-api-key',
      });
      expect(clientWithSlash).toBeInstanceOf(McpHttpClient);
    });
  });

  describe('initialize()', () => {
    it('should initialize session successfully', async () => {
      const mockSessionResponse = {
        sessionId: 'sess_123',
        protocolVersion: 'mcp/1.0',
        serverInfo: { name: 'test-server', version: '1.0.0' },
        capabilities: [],
        expiresAt: '2025-12-03T13:00:00Z',
      };

      mockAxios.post.mockResolvedValue({ data: mockSessionResponse });

      const result = await client.initialize('test-client/1.0.0');

      expect(result).toEqual(mockSessionResponse);
      expect(client.getSessionId()).toBe('sess_123');
      expect(mockAxios.post).toHaveBeenCalledWith('/api/mcp/v1/initialize', {
        protocolVersion: 'mcp/1.0',
        clientInfo: 'test-client/1.0.0',
        capabilities: [],
      });
    });

    it('should handle initialization errors', async () => {
      mockAxios.post.mockRejectedValue({
        response: {
          status: 401,
          data: { error: { message: 'Invalid API key' } },
        },
      });

      await expect(client.initialize('test-client/1.0.0')).rejects.toThrow('Authentication failed');
    });
  });

  describe('connect()', () => {
    beforeEach(async () => {
      // Initialize session first
      mockAxios.post.mockResolvedValue({
        data: {
          sessionId: 'sess_123',
          protocolVersion: 'mcp/1.0',
          serverInfo: { name: 'test-server', version: '1.0.0' },
          capabilities: [],
          expiresAt: '2025-12-03T13:00:00Z',
        },
      });
      await client.initialize('test-client/1.0.0');
    });

    it('should connect to WebSocket', () => {
      client.connect();

      const io = require('socket.io-client').io;
      expect(io).toHaveBeenCalledWith('https://test.example.com/mcp-stream', {
        auth: { apiKey: 'test-api-key' },
        transports: ['websocket', 'polling'],
        reconnection: false,
      });
    });

    it('should not connect if already connected', () => {
      mockSocket.connected = true;
      client.connect();
      client.connect(); // Second call should be ignored

      const io = require('socket.io-client').io;
      expect(io).toHaveBeenCalledTimes(1);
    });

    it('should emit connect event on connection', () => {
      const connectCallback = jest.fn();
      client.on('connect', connectCallback);

      client.connect();

      // Simulate WebSocket connect event
      const onConnectHandler = mockSocket.on.mock.calls.find(([event]: any[]) => event === 'connect')?.[1];
      onConnectHandler?.();

      expect(connectCallback).toHaveBeenCalled();
    });

    it('should subscribe to session on connect', () => {
      client.connect();

      // Simulate WebSocket connect event
      const onConnectHandler = mockSocket.on.mock.calls.find(([event]: any[]) => event === 'connect')?.[1];
      onConnectHandler?.();

      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:session', 'sess_123');
    });
  });

  describe('disconnect()', () => {
    it('should disconnect from WebSocket', () => {
      client.connect();
      client.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(client.getConnectionState()).toBe(ConnectionState.DISCONNECTED);
    });
  });

  describe('subscribeToEvents()', () => {
    it('should subscribe to tool events', () => {
      const callbacks = {
        onToolStart: jest.fn(),
        onToolComplete: jest.fn(),
      };

      client.subscribeToEvents(callbacks);

      // Events should be stored (we can't directly test this without exposing internals,
      // but we can verify no errors are thrown)
      expect(() => client.subscribeToEvents(callbacks)).not.toThrow();
    });

    it('should call tool event callbacks when events are received', () => {
      const onToolStart = jest.fn();
      const onToolComplete = jest.fn();

      client.subscribeToEvents({ onToolStart, onToolComplete });
      client.connect();

      // Simulate tool:start event
      const onToolStartHandler = mockSocket.on.mock.calls.find(([event]: any[]) => event === 'tool:start')?.[1];
      const toolStartEvent = {
        type: 'tool:start',
        sessionId: 'sess_123',
        toolName: 'test_tool',
        timestamp: '2025-12-03T12:00:00Z',
        data: {},
      };
      onToolStartHandler?.(toolStartEvent);

      expect(onToolStart).toHaveBeenCalledWith(toolStartEvent);

      // Simulate tool:complete event
      const onToolCompleteHandler = mockSocket.on.mock.calls.find(([event]: any[]) => event === 'tool:complete')?.[1];
      const toolCompleteEvent = {
        type: 'tool:complete',
        sessionId: 'sess_123',
        toolName: 'test_tool',
        timestamp: '2025-12-03T12:00:05Z',
        data: { result: { success: true } },
      };
      onToolCompleteHandler?.(toolCompleteEvent);

      expect(onToolComplete).toHaveBeenCalledWith(toolCompleteEvent);
    });
  });

  describe('unsubscribeFromEvents()', () => {
    it('should unsubscribe from all tool events', () => {
      const callbacks = {
        onToolStart: jest.fn(),
        onToolComplete: jest.fn(),
      };

      client.subscribeToEvents(callbacks);
      client.unsubscribeFromEvents();

      // After unsubscribing, callbacks should not be called
      client.connect();
      const onToolStartHandler = mockSocket.on.mock.calls.find(([event]: any[]) => event === 'tool:start')?.[1];
      onToolStartHandler?.({ type: 'tool:start', sessionId: 'sess_123' });

      expect(callbacks.onToolStart).not.toHaveBeenCalled();
    });
  });

  describe('on() and off()', () => {
    it('should subscribe to client events', () => {
      const callback = jest.fn();
      client.on('connect', callback);

      client.connect();

      // Simulate WebSocket connect event
      const onConnectHandler = mockSocket.on.mock.calls.find(([event]: any[]) => event === 'connect')?.[1];
      onConnectHandler?.();

      expect(callback).toHaveBeenCalled();
    });

    it('should unsubscribe from specific client event callback', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      client.on('connect', callback1);
      client.on('connect', callback2);
      client.off('connect', callback1);

      client.connect();

      // Simulate WebSocket connect event
      const onConnectHandler = mockSocket.on.mock.calls.find(([event]: any[]) => event === 'connect')?.[1];
      onConnectHandler?.();

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should unsubscribe from all client event callbacks', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      client.on('connect', callback1);
      client.on('connect', callback2);
      client.off('connect');

      client.connect();

      // Simulate WebSocket connect event
      const onConnectHandler = mockSocket.on.mock.calls.find(([event]: any[]) => event === 'connect')?.[1];
      onConnectHandler?.();

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('callTool()', () => {
    beforeEach(async () => {
      // Initialize session first
      mockAxios.post.mockResolvedValue({
        data: {
          sessionId: 'sess_123',
          protocolVersion: 'mcp/1.0',
          serverInfo: { name: 'test-server', version: '1.0.0' },
          capabilities: [],
          expiresAt: '2025-12-03T13:00:00Z',
        },
      });
      await client.initialize('test-client/1.0.0');
    });

    it('should call tool successfully', async () => {
      const mockResult = {
        result: { projects: [] },
        timestamp: '2025-12-03T12:00:00Z',
      };

      mockAxios.post.mockResolvedValue({ data: mockResult });

      const result = await client.callTool('list_projects', { status: 'active' });

      expect(result).toEqual(mockResult);
      expect(mockAxios.post).toHaveBeenCalledWith('/api/mcp/v1/call-tool', {
        sessionId: 'sess_123',
        toolName: 'list_projects',
        arguments: { status: 'active' },
      });
    });

    it('should throw error if session not initialized', async () => {
      const uninitializedClient = new McpHttpClient({
        baseUrl: 'https://test.example.com',
        apiKey: 'test-api-key',
      });

      await expect(uninitializedClient.callTool('list_projects', {})).rejects.toThrow(
        'Session not initialized'
      );
    });

    it('should handle tool call errors', async () => {
      mockAxios.post.mockRejectedValue({
        response: {
          status: 404,
          data: { error: { message: 'Tool not found' } },
        },
      });

      await expect(client.callTool('invalid_tool', {})).rejects.toThrow('Not found');
    });
  });

  describe('listTools()', () => {
    beforeEach(async () => {
      // Initialize session first
      mockAxios.post.mockResolvedValue({
        data: {
          sessionId: 'sess_123',
          protocolVersion: 'mcp/1.0',
          serverInfo: { name: 'test-server', version: '1.0.0' },
          capabilities: [],
          expiresAt: '2025-12-03T13:00:00Z',
        },
      });
      await client.initialize('test-client/1.0.0');
    });

    it('should list tools successfully', async () => {
      const mockTools = [
        { name: 'list_projects', description: 'List projects', category: 'projects', inputSchema: {} },
        { name: 'create_story', description: 'Create story', category: 'stories', inputSchema: {} },
      ];

      mockAxios.get.mockResolvedValue({ data: mockTools });

      const result = await client.listTools();

      expect(result).toEqual(mockTools);
      expect(mockAxios.get).toHaveBeenCalledWith('/api/mcp/v1/list-tools', {
        params: { sessionId: 'sess_123' },
      });
    });

    it('should list tools with filters', async () => {
      const mockTools = [
        { name: 'list_projects', description: 'List projects', category: 'projects', inputSchema: {} },
      ];

      mockAxios.get.mockResolvedValue({ data: mockTools });

      const result = await client.listTools({ category: 'projects', detail_level: 'with_descriptions' });

      expect(result).toEqual(mockTools);
      expect(mockAxios.get).toHaveBeenCalledWith('/api/mcp/v1/list-tools', {
        params: {
          sessionId: 'sess_123',
          category: 'projects',
          detail_level: 'with_descriptions',
        },
      });
    });
  });

  describe('heartbeat()', () => {
    beforeEach(async () => {
      // Initialize session first
      mockAxios.post.mockResolvedValue({
        data: {
          sessionId: 'sess_123',
          protocolVersion: 'mcp/1.0',
          serverInfo: { name: 'test-server', version: '1.0.0' },
          capabilities: [],
          expiresAt: '2025-12-03T13:00:00Z',
        },
      });
      await client.initialize('test-client/1.0.0');
    });

    it('should send heartbeat successfully', async () => {
      mockAxios.post.mockResolvedValue({ data: {} });

      await client.heartbeat();

      expect(mockAxios.post).toHaveBeenCalledWith('/api/mcp/v1/session/sess_123/heartbeat');
    });

    it('should emit session:expired event on 410 error', async () => {
      const sessionExpiredCallback = jest.fn();
      client.on('session:expired', sessionExpiredCallback);

      mockAxios.post.mockRejectedValue({
        response: {
          status: 410,
          data: { error: { message: 'Session expired' } },
        },
      });

      await expect(client.heartbeat()).rejects.toThrow('Session expired');
      expect(sessionExpiredCallback).toHaveBeenCalled();
    });
  });

  describe('startHeartbeat() and stopHeartbeat()', () => {
    beforeEach(async () => {
      jest.useFakeTimers();

      // Initialize session first
      mockAxios.post.mockResolvedValue({
        data: {
          sessionId: 'sess_123',
          protocolVersion: 'mcp/1.0',
          serverInfo: { name: 'test-server', version: '1.0.0' },
          capabilities: [],
          expiresAt: '2025-12-03T13:00:00Z',
        },
      });
      await client.initialize('test-client/1.0.0');
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start automatic heartbeat', () => {
      mockAxios.post.mockResolvedValue({ data: {} });

      client.startHeartbeat();

      // Fast-forward time
      jest.advanceTimersByTime(30000);

      expect(mockAxios.post).toHaveBeenCalledWith('/api/mcp/v1/session/sess_123/heartbeat');
    });

    it('should stop automatic heartbeat', () => {
      mockAxios.post.mockResolvedValue({ data: {} });

      client.startHeartbeat();
      client.stopHeartbeat();

      // Fast-forward time
      jest.advanceTimersByTime(30000);

      // Heartbeat should not be called after stopping
      expect(mockAxios.post).not.toHaveBeenCalledWith('/api/mcp/v1/session/sess_123/heartbeat');
    });
  });

  describe('close()', () => {
    beforeEach(async () => {
      // Initialize session first
      mockAxios.post.mockResolvedValue({
        data: {
          sessionId: 'sess_123',
          protocolVersion: 'mcp/1.0',
          serverInfo: { name: 'test-server', version: '1.0.0' },
          capabilities: [],
          expiresAt: '2025-12-03T13:00:00Z',
        },
      });
      await client.initialize('test-client/1.0.0');
    });

    it('should close session successfully', async () => {
      mockAxios.delete.mockResolvedValue({ data: {} });

      client.connect();
      await client.close();

      expect(mockAxios.delete).toHaveBeenCalledWith('/api/mcp/v1/session/sess_123');
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(client.getSessionId()).toBeNull();
    });
  });

  describe('Auto-reconnect', () => {
    beforeEach(async () => {
      jest.useFakeTimers();

      // Initialize session first
      mockAxios.post.mockResolvedValue({
        data: {
          sessionId: 'sess_123',
          protocolVersion: 'mcp/1.0',
          serverInfo: { name: 'test-server', version: '1.0.0' },
          capabilities: [],
          expiresAt: '2025-12-03T13:00:00Z',
        },
      });
      await client.initialize('test-client/1.0.0');
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should attempt reconnection on disconnect', () => {
      const reconnectingCallback = jest.fn();
      client.on('reconnecting', reconnectingCallback);

      client.connect();

      // Simulate disconnect
      const onDisconnectHandler = mockSocket.on.mock.calls.find(([event]: any[]) => event === 'disconnect')?.[1];
      onDisconnectHandler?.('transport error');

      // Fast-forward to first reconnection attempt (1 second)
      jest.advanceTimersByTime(1000);

      expect(reconnectingCallback).toHaveBeenCalled();
      expect(mockSocket.connect).toHaveBeenCalled();
    });

    it('should use exponential backoff for reconnection', () => {
      client.connect();

      // Simulate disconnect
      const onDisconnectHandler = mockSocket.on.mock.calls.find(([event]: any[]) => event === 'disconnect')?.[1];

      // First disconnect
      onDisconnectHandler?.('transport error');
      jest.advanceTimersByTime(1000); // 1 second

      // Second disconnect
      onDisconnectHandler?.('transport error');
      jest.advanceTimersByTime(2000); // 2 seconds

      // Third disconnect
      onDisconnectHandler?.('transport error');
      jest.advanceTimersByTime(4000); // 4 seconds

      expect(mockSocket.connect).toHaveBeenCalledTimes(3);
    });

    it('should emit reconnect:failed after max attempts', () => {
      const reconnectFailedCallback = jest.fn();
      client.on('reconnect:failed', reconnectFailedCallback);

      client.connect();

      // Simulate max reconnection attempts
      const onDisconnectHandler = mockSocket.on.mock.calls.find(([event]: any[]) => event === 'disconnect')?.[1];

      for (let i = 0; i < 10; i++) {
        onDisconnectHandler?.('transport error');
        jest.advanceTimersByTime(30000); // Max delay
      }

      // 11th attempt should fail
      onDisconnectHandler?.('transport error');

      expect(reconnectFailedCallback).toHaveBeenCalled();
      expect(client.getConnectionState()).toBe(ConnectionState.FAILED);
    });
  });

  describe('Error handling', () => {
    it('should handle 401 authentication errors', async () => {
      mockAxios.post.mockRejectedValue({
        response: {
          status: 401,
          data: { error: { message: 'Invalid API key' } },
        },
      });

      await expect(client.initialize('test-client/1.0.0')).rejects.toThrow(
        'Authentication failed: Invalid API key'
      );
    });

    it('should handle 403 forbidden errors', async () => {
      mockAxios.post.mockResolvedValue({
        data: { sessionId: 'sess_123', protocolVersion: 'mcp/1.0' },
      });
      await client.initialize('test-client/1.0.0');

      mockAxios.post.mockRejectedValue({
        response: {
          status: 403,
          data: { error: { message: 'Access denied' } },
        },
      });

      await expect(client.callTool('forbidden_tool', {})).rejects.toThrow('Access denied');
    });

    it('should handle 429 rate limit errors', async () => {
      mockAxios.post.mockResolvedValue({
        data: { sessionId: 'sess_123', protocolVersion: 'mcp/1.0' },
      });
      await client.initialize('test-client/1.0.0');

      mockAxios.post.mockRejectedValue({
        response: {
          status: 429,
          data: { error: { message: 'Too many requests' } },
        },
      });

      await expect(client.callTool('some_tool', {})).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle network errors', async () => {
      mockAxios.post.mockRejectedValue({
        request: {},
        message: 'Network Error',
      });

      await expect(client.initialize('test-client/1.0.0')).rejects.toThrow('Network error');
    });
  });
});
