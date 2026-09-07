# --- Build stage ---
FROM node:20-bookworm-slim AS build
WORKDIR /repo

# Install deps for the whole workspace (needed because this is an npm workspaces monorepo)
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --workspace=apps/api --include-workspace-root

COPY apps/api apps/api
WORKDIR /repo/apps/api
RUN npx prisma generate
RUN npm run build

# --- Runtime stage ---
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma

# Persistent SQLite storage lives in /app/data (mount a volume here)
RUN mkdir -p /app/data

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
