# StoryOS API on Railway — monorepo: NestJS (apps/api) + Prisma (packages/database)
#
# Deploy this service from repo root (same directory as Dockerfile).
FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/api ./apps/api
COPY packages ./packages

RUN npm ci \
  && npm run db:generate \
  && npm run build --workspace=@storyos/types \
  && npm run build --workspace=@storyos/database \
  && npm run build --workspace=@storyos/api

ENV NODE_ENV=production

WORKDIR /app/apps/api
EXPOSE 3001

# Railway sets PORT; Nest uses process.env.PORT ?? 3001
CMD ["node", "dist/apps/api/src/main.js"]
