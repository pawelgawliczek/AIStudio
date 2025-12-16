// ST-268: Polyfill globalThis.crypto for @nestjs/schedule in Node 18
// The crypto.randomUUID() is used by SchedulerOrchestrator
import * as nodeCrypto from 'crypto';
if (!globalThis.crypto) {
  (globalThis as any).crypto = nodeCrypto;
}

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { WinstonLoggerService, AllExceptionsFilter, LoggingInterceptor } from './common';
import { setSharedWebSocketGateway } from './mcp/services/websocket-gateway.instance';
import { initializeTelemetry, registerTelemetryShutdownHandlers } from './telemetry/telemetry.init';
import { AppWebSocketGateway } from './websocket/websocket.gateway';

// ST-257: Initialize OpenTelemetry BEFORE any other imports/code
// This ensures all HTTP/Express instrumentations are registered before NestJS starts
initializeTelemetry();
registerTelemetryShutdownHandlers();

async function bootstrap() {
  // Fix BigInt serialization issue
  // @ts-ignore
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Custom logger
  const logger = new WinstonLoggerService();
  app.useLogger(logger);

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  // Global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor(logger));

  // Task 5.1: Security Headers (Helmet)
  // Protects against common web vulnerabilities
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'wss:', 'ws:'], // Allow WebSocket connections
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      // Disable X-Powered-By header to prevent tech stack disclosure
      hidePoweredBy: true,
      // Prevent MIME type sniffing
      noSniff: true,
      // Enable XSS protection
      xssFilter: true,
      // Prevent clickjacking
      frameguard: {
        action: 'deny',
      },
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://aistudio.example.com',
      'https://vibestudio.example.com',
    ],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger documentation - temporarily disabled for testing
  // const config = new DocumentBuilder()
  //   .setTitle('Vibe Studio API')
  //   .setDescription('MCP Control Plane API for managing AI agentic frameworks')
  //   .setVersion('0.1.0')
  //   .addTag('auth', 'Authentication and authorization endpoints')
  //   .addTag('users', 'User management endpoints')
  //   .addTag('projects', 'Project management endpoints')
  //   .addBearerAuth(
  //     {
  //       type: 'http',
  //       scheme: 'bearer',
  //       bearerFormat: 'JWT',
  //       description: 'Enter JWT token',
  //       name: 'Authorization',
  //       in: 'header',
  //     },
  //     'JWT-auth',
  //   )
  //   .build();
  // const document = SwaggerModule.createDocument(app, config);
  // SwaggerModule.setup('api/docs', app, document, {
  //   swaggerOptions: {
  //     persistAuthorization: true,
  //   },
  // });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  // ST-129: Share the NestJS WebSocket gateway with MCP handlers
  const wsGateway = app.get(AppWebSocketGateway);
  setSharedWebSocketGateway(wsGateway);
  logger.log('📡 WebSocket gateway shared with MCP handlers', 'Bootstrap');

  logger.log(`🚀 Application is running on: http://localhost:${port}`, 'Bootstrap');
  logger.log(`📚 API Documentation: http://localhost:${port}/api/docs`, 'Bootstrap');
}

bootstrap();
