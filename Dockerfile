FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/playlists.json ./

RUN --mount=type=bind,from=builder,source=/app,target=/mnt/builder \
  if [ -f /mnt/builder/cached_playlists.json ]; then cp /mnt/builder/cached_playlists.json ./; fi

COPY package.json songs.db* ./

ENV PORT=8080
EXPOSE 8080
RUN mkdir -p /app/media && chown -R node:node /app
USER node
CMD ["node", "dist/server.cjs"]
