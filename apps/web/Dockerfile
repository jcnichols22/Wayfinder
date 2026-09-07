# --- Build stage ---
FROM node:20-bookworm-slim AS build
WORKDIR /repo

COPY package.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install --workspace=apps/web --include-workspace-root

COPY apps/web apps/web
WORKDIR /repo/apps/web
RUN npm run build

# --- Runtime stage ---
FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
