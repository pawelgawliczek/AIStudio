import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VersioningService } from './versioning.service';

@Module({
  imports: [PrismaModule],
  providers: [VersioningService],
  exports: [VersioningService],
})
export class VersioningModule {}
