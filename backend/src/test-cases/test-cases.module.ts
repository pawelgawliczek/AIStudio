import { Module } from '@nestjs/common';
import { TestCasesService } from './test-cases.service';
import { TestCasesController } from './test-cases.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TestCasesController],
  providers: [TestCasesService],
  exports: [TestCasesService]
})
export class TestCasesModule {}
