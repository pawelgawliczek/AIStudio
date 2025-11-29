# Story Runner Dockerfile
# Node.js container with Claude Code CLI for workflow execution

FROM node:20-slim

# Install dependencies for Claude Code CLI
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy TypeScript config and source
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Create non-root user for security
RUN useradd -m -s /bin/bash runner
RUN chown -R runner:runner /app

# Switch to non-root user
USER runner

# Create checkpoint directory
RUN mkdir -p /app/.runner/checkpoints

# Environment variables
ENV NODE_ENV=production
ENV RUNNER_WORKING_DIRECTORY=/workspace
ENV RUNNER_BACKEND_URL=http://backend:3001

# Entry point
ENTRYPOINT ["node", "dist/index.js"]

# Default command (can be overridden)
CMD ["--help"]
