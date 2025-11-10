# Development Dockerfile for Backend
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY shared/package*.json ./shared/

RUN npm ci

# Copy source code
COPY backend ./backend
COPY shared ./shared

# Generate Prisma Client
WORKDIR /app/backend
RUN npx prisma generate

WORKDIR /app

EXPOSE 3000

CMD ["npm", "run", "dev", "--workspace=backend"]
