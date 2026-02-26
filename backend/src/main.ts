// Register tsconfig-paths BEFORE any other imports that rely on path aliases
import 'tsconfig-paths/register';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module'; // Corrected relative path
import { ValidationPipe } from '@nestjs/common'; // Import ValidationPipe
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Apply security headers with helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Disable if causing issues with CORS
    }),
  );

  // Configure body parser for large homomorphic ciphertexts
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Enable cookie parsing for HTTP-only cookies
  app.use(cookieParser());

  // Enable CORS with proper configuration for credentials
  app.enableCors({
    origin: 'http://localhost:3000', // Frontend URL
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Important for cookies/auth
    allowedHeaders: 'Content-Type,Authorization',
  });

  // Set global API prefix for consistent routing
  app.setGlobalPrefix('api');

  // Add Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Automatically transform payloads to DTO instances
      whitelist: true, // Strip properties that do not have any decorators
      // forbidNonWhitelisted: true, // Optionally throw error if non-whitelisted properties are present
      transformOptions: {
        enableImplicitConversion: true, // Allow conversion of basic types (e.g., string to number for path params),
      },
    }),
  );

  // Use PORT from .env, default to 3001 to avoid conflict with frontend default 3000
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Backend application is running on: http://localhost:${port}`);
}
bootstrap();
