# StoryOS API — Docker deploy (Railway, Render, etc.)
# Monorepo: NestJS (apps/api) + Prisma workspace (packages/database)
#
# Build from repo root. Platform must set DATABASE_URL at runtime for Prisma migrations (run separately).
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

# Render/Railway set PORT at runtime; Nest uses process.env.PORT ?? 3001
CMD ["node", "dist/apps/api/src/main.js"]
