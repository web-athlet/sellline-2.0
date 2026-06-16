import { Module } from '@nestjs/common';
import { GdprController } from './gdpr.controller';
import { GdprService } from './gdpr.service';
import { HardDeleteService } from './hard-delete.service';

/**
 * DSGVO module: Art. 20 data export (GdprService/GdprController) and the Art. 17
 * hard-delete retention cron (HardDeleteService). PrismaService + EncryptionService
 * come from their @Global modules.
 */
@Module({
  controllers: [GdprController],
  providers: [GdprService, HardDeleteService],
  exports: [GdprService, HardDeleteService],
})
export class GdprModule {}
