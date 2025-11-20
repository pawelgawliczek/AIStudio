process.env.DATABASE_URL =
  'postgresql://postgres:CHANGE_ME_POSTGRES_PASSWORD@127.0.0.1:5433/vibestudio?schema=public';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.project
  .findFirst()
  .then((r) => console.log('Query succeeded:', !!r))
  .catch((e) => console.error('Query failed:', e.message))
  .finally(() => prisma.$disconnect());
