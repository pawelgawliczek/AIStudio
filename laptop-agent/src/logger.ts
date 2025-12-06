/**
 * Simple logger utility for laptop-agent
 */

export class Logger {
  constructor(private context: string) {}

  info(message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.context}] [INFO] ${message}`, meta || '');
  }

  debug(message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.context}] [DEBUG] ${message}`, meta || '');
  }

  warn(message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [${this.context}] [WARN] ${message}`, meta || '');
  }

  error(message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${this.context}] [ERROR] ${message}`, meta || '');
  }
}
