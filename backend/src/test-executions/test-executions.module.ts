import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TestExecutionsController } from './test-executions.controller';
import { TestExecutionsService } from './test-executions.service';

@Module({
  imports: [PrismaModule],
  controllers: [TestExecutionsController],
  providers: [TestExecutionsService],
  exports: [TestExecutionsService]
})
export class TestExecutionsModule {}
