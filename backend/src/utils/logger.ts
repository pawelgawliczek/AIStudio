export class Logger {
  constructor(private readonly context: string) {}

  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: unknown) {
    const payload = meta ? ` ${JSON.stringify(meta)}` : '';
    // eslint-disable-next-line no-console
    console.log(`[${new Date().toISOString()}][${this.context}][${level.toUpperCase()}] ${message}${payload}`);
  }

  info(message: string, meta?: unknown) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: unknown) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: unknown) {
    this.log('error', message, meta);
  }

  debug(message: string, meta?: unknown) {
    this.log('debug', message, meta);
  }
}
