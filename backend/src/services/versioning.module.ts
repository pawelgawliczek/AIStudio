import { Module } from '@nestjs/common';
import { VersioningController } from '../controllers/versioning.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ChecksumService } from './checksum.service';
import { VersioningService } from './versioning.service';

@Module({
  imports: [PrismaModule],
  controllers: [VersioningController],
  providers: [VersioningService, ChecksumService],
  exports: [VersioningService, ChecksumService],
})
export class VersioningModule {}
