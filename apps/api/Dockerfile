# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

FROM deps AS builder
COPY . .

RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/database
RUN npm run build --workspace=apps/api

FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/package.json
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/packages/database/scripts ./packages/database/scripts
COPY --from=builder /app/packages/database/prisma.config.ts ./packages/database/prisma.config.ts
COPY apps/api/docker/start-prod.sh ./apps/api/docker/start-prod.sh

RUN chmod +x /app/apps/api/docker/start-prod.sh && \
    mkdir -p /app/apps/api/uploads/incidents && \
    chown -R node:node /app/apps/api/uploads

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "const port = process.env.PORT || '3000'; fetch('http://127.0.0.1:' + port + '/api/v1/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]

WORKDIR /app/apps/api
USER node

CMD ["/bin/sh", "/app/apps/api/docker/start-prod.sh"]
