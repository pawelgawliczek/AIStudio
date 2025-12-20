/**
 * ST-334: Health Server for laptop-agent
 *
 * Simple HTTP server providing connection status on port 3002.
 * Used by SessionStart hook to verify laptop connectivity for workflow sessions.
 *
 * Features:
 * - Native Node.js http module (minimal overhead)
 * - GET /health endpoint
 * - Returns connection status, agentId, and uptime
 * - Binds to 127.0.0.1 only (localhost security)
 */

import * as http from 'http';
import { Logger } from './logger';

export interface HealthStatus {
  status: 'connected' | 'disconnected';
  agentId: string | null;
  uptime: number;
}

export class HealthServer {
  private server: http.Server | null = null;
  private readonly port: number;
  private readonly logger = new Logger('HealthServer');
  private getStatus: (() => HealthStatus) | null = null;

  constructor(port: number) {
    this.port = port;
  }

  async start(getStatus: () => HealthStatus): Promise<void> {
    if (this.server) {
      this.logger.warn('Health server already started', { port: this.port });
      return;
    }

    this.getStatus = getStatus;

    this.server = http.createServer((req, res) => {
      // Simple routing - only /health endpoint
      if (req.method === 'GET' && req.url === '/health') {
        const status = this.getStatus!();
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*', // For future menu bar app
        });
        res.end(JSON.stringify(status));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(this.port, '127.0.0.1', () => {
        this.logger.info('Health server started', { port: this.port });
        resolve();
      });

      this.server!.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          this.logger.error('Health server port already in use', {
            port: this.port,
            suggestion: 'Change HEALTH_PORT in config or stop other service',
          });
        } else {
          this.logger.error('Health server error', { error: error.message });
        }
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.logger.info('Health server stopped');
          this.server = null;
          resolve();
        });
      });
    }
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null;
  }
}
