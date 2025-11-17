import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UseCasesController } from './use-cases.controller';
import { UseCasesService } from './use-cases.service';

@Module({
  imports: [PrismaModule],
  controllers: [UseCasesController],
  providers: [UseCasesService],
  exports: [UseCasesService],
})
export class UseCasesModule {}
