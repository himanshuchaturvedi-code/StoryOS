import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  allowedOrigins: process.env['ALLOWED_ORIGINS']?.split(',') ?? ['http://localhost:3000'],
}));

export const dbConfig = registerAs('database', () => ({
  url: process.env['DATABASE_URL'],
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env['JWT_SECRET'],
  expiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',
  refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] ?? '30d',
}));

export const storageConfig = registerAs('storage', () => ({
  /**
   * Storage key format enforced in DocumentsService:
   * documents/{organizationId}/{projectId}/{documentId}/{fileName}
   */
  bucket: process.env['STORAGE_BUCKET'] ?? 'storyos-documents',
  region: process.env['STORAGE_REGION'] ?? 'ca-central-1',
  endpoint: process.env['STORAGE_ENDPOINT'],
}));
