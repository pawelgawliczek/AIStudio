import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixArchitectTimestamp() {
  const result = await prisma.story.update({
    where: { id: 'a89629d4-26e3-46b8-8746-3bd02f02e201' },
    data: {
      architectAnalyzedAt: new Date(),
    },
  });

  console.log('✅ Set architectAnalyzedAt timestamp:', result.architectAnalyzedAt);
}

fixArchitectTimestamp()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
