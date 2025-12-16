import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import * as api from '@opentelemetry/api';

@Injectable()
export class WinstonLoggerService implements LoggerService {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
        // ST-258 Phase 3: Add traceId to all log entries
        winston.format((info) => {
          const span = api.trace.getActiveSpan();
          if (span) {
            const spanContext = span.spanContext();
            info.trace_id = spanContext.traceId;
            info.span_id = spanContext.spanId;
          }
          return info;
        })(),
      ),
      defaultMeta: { service: 'aistudio-backend' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, context, trace, trace_id }) => {
              const traceInfo = trace_id ? ` [trace_id=${trace_id}]` : '';
              return `${timestamp} [${context || 'Application'}] ${level}: ${message}${traceInfo}${
                trace ? `\n${trace}` : ''
              }`;
            }),
          ),
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
        }),
      ],
    });
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { context, trace });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context });
  }
}
