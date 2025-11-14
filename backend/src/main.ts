import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { WinstonLoggerService, AllExceptionsFilter, LoggingInterceptor } from './common';

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
  logger.log(`🚀 Application is running on: http://localhost:${port}`, 'Bootstrap');
  logger.log(`📚 API Documentation: http://localhost:${port}/api/docs`, 'Bootstrap');
}

bootstrap();
