import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VersioningService } from './versioning.service';
import { ChecksumService } from './checksum.service';
import { VersioningController } from '../controllers/versioning.controller';

@Module({
  imports: [PrismaModule],
  controllers: [VersioningController],
  providers: [VersioningService, ChecksumService],
  exports: [VersioningService, ChecksumService],
})
export class VersioningModule {}
