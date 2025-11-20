process.env.DATABASE_URL =
  'postgresql://postgres:361a30c6d68396be29c7eddc3f9ff1b1cfe07675c707232a370bda33f7c8b518@127.0.0.1:5433/vibestudio?schema=public';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.project
  .findFirst()
  .then((r) => console.log('Query succeeded:', !!r))
  .catch((e) => console.error('Query failed:', e.message))
  .finally(() => prisma.$disconnect());
