# Development Dockerfile for Frontend
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY shared/package*.json ./shared/

RUN npm ci

# Copy source code
COPY frontend ./frontend
COPY shared ./shared

EXPOSE 5173

CMD ["npm", "run", "dev", "--workspace=frontend"]
