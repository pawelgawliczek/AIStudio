import { Module } from '@nestjs/common';
import { UseCasesController } from './use-cases.controller';
import { UseCasesService } from './use-cases.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UseCasesController],
  providers: [UseCasesService],
  exports: [UseCasesService],
})
export class UseCasesModule {}
