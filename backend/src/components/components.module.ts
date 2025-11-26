import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ComponentsController, AgentsController } from './components.controller';
import { ComponentsService } from './components.service';

@Module({
  imports: [PrismaModule],
  controllers: [ComponentsController, AgentsController],
  providers: [ComponentsService],
  exports: [ComponentsService],
})
export class ComponentsModule {}
