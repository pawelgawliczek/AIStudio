import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UseCasesController } from './use-cases.controller';
import { UseCasesService } from './use-cases.service';
import { UseCasesCrudService } from './services/use-cases-crud.service';
import { UseCasesSearchService } from './services/use-cases-search.service';

@Module({
  imports: [PrismaModule],
  controllers: [UseCasesController],
  providers: [
    UseCasesService,
    UseCasesCrudService,
    UseCasesSearchService,
  ],
  exports: [UseCasesService],
})
export class UseCasesModule {}
