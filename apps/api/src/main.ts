import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet());

  // Global validation pipe — strips unknown properties, transforms types
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS — tighten origins in production via config
  app.enableCors({
    origin: process.env['ALLOWED_ORIGINS']?.split(',') ?? [
      'http://localhost:3000',
    ],
    credentials: true,
  });

  // Global API prefix
  app.setGlobalPrefix('api');

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);

  console.log(`StoryOS API running on: http://localhost:${port}/api`);
}

bootstrap();
