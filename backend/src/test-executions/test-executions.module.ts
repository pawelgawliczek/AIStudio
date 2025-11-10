import { Module } from '@nestjs/common';
import { TestExecutionsService } from './test-executions.service';
import { TestExecutionsController } from './test-executions.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TestExecutionsController],
  providers: [TestExecutionsService],
  exports: [TestExecutionsService]
})
export class TestExecutionsModule {}
