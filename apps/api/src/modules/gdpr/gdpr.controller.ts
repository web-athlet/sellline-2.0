import { Controller, ForbiddenException, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@nextgen/db';
import type { Response } from 'express';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { ONCE_PER_DAY, UserThrottlerGuard } from '../../common/throttler/user-throttler.guard';
import { GdprService } from './gdpr.service';

@Controller({ path: 'gdpr', version: '1' })
export class GdprController {
  constructor(private readonly gdpr: GdprService) {}

  /**
   * DSGVO Art. 20 export. Only the data subject themselves or an ADMIN may export.
   * Streams a ZIP of the user's data. Rate-limited to 1/24h per user (Block 4).
   */
  @UseGuards(UserThrottlerGuard)
  @Throttle(ONCE_PER_DAY)
  @Get('export/:userId')
  async export(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    if (user.id !== userId && user.role !== Role.ADMIN) {
      throw new ForbiddenException('You may only export your own data');
    }
    const bundle = await this.gdpr.collectExport(userId);
    await this.gdpr.writeArchive(bundle, userId, res);
  }
}
