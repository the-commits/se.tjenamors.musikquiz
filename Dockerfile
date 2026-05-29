FROM node:22-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json first for better caching
COPY package*.json ./

# Install all dependencies (including devDependencies required for build)
RUN npm install

# Copy the rest of the application
COPY . .

# Build the client (Vite) and the server (esbuild)
RUN npm run build

# Second stage: minimal image for production
FROM node:22-alpine

WORKDIR /app

# Copy package.json to install production dependencies only
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

# Copy the built assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/playlists.json ./

# Set environment to production
ENV NODE_ENV=production

# Expose the server port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
