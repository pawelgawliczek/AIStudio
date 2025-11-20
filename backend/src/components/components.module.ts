import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ComponentsController } from './components.controller';
import { ComponentsService } from './components.service';

@Module({
  imports: [PrismaModule],
  controllers: [ComponentsController],
  providers: [ComponentsService],
  exports: [ComponentsService],
})
export class ComponentsModule {}
