import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Redirect,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { CampaignsService } from './campaigns.service';

const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const UNSUB_PAGE = (firstName: string, campaignName: string, confirmed: boolean) => `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><title>Abmeldung</title>
<style>body{font-family:sans-serif;max-width:480px;margin:80px auto;padding:0 16px;text-align:center}
h1{font-size:1.5rem;color:#1e293b}.btn{display:inline-block;margin-top:24px;padding:10px 24px;
background:#ef4444;color:#fff;border-radius:6px;text-decoration:none;font-size:.9rem;border:none;cursor:pointer}
.ok{color:#16a34a;font-size:1.2rem}</style></head>
<body>
${
  confirmed
    ? `<div class="ok">✓</div><h1>Abmeldung erfolgreich</h1>
<p>${firstName ? `${firstName}, Sie wurden` : 'Sie wurden'} erfolgreich vom Newsletter <strong>${campaignName}</strong> abgemeldet.</p>`
    : `<h1>Abmelden?</h1>
<p>Möchten Sie sich vom Newsletter <strong>${campaignName}</strong> abmelden?</p>
<form method="POST"><button type="submit" class="btn">Ja, jetzt abmelden</button></form>`
}
</body></html>`;

@Public()
@Controller({ path: 'public', version: '1' })
export class CampaignTrackingController {
  constructor(private readonly campaigns: CampaignsService) {}

  // ─── Open Tracking Pixel ──────────────────────────────────────────────────

  @Get('track/open/:token')
  @HttpCode(HttpStatus.OK)
  async trackOpen(@Param('token') token: string, @Res() res: Response): Promise<void> {
    await this.campaigns.trackOpen(token).catch(() => undefined);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200).end(PIXEL_PNG);
  }

  // ─── Click Tracking Redirect ──────────────────────────────────────────────

  @Get('track/click/:token')
  @Redirect()
  async trackClick(
    @Param('token') token: string,
    @Query('url') url: string,
  ): Promise<{ url: string; statusCode: number }> {
    if (!url) throw new BadRequestException('url query param required');
    const destination = await this.campaigns.trackClick(token, url).catch(() => null);
    if (!destination) throw new BadRequestException('Invalid tracking token');
    return { url: destination, statusCode: 302 };
  }

  // ─── Unsubscribe Landing Page ─────────────────────────────────────────────

  @Get('unsubscribe/:token')
  @HttpCode(HttpStatus.OK)
  async unsubscribePage(@Param('token') token: string, @Res() res: Response): Promise<void> {
    const parsed = this.campaigns.validateTrackingToken(token);
    if (!parsed || parsed.action !== 'unsub') {
      res.status(400).send('Invalid link');
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(UNSUB_PAGE('', '', false));
  }

  @Post('unsubscribe/:token')
  @HttpCode(HttpStatus.OK)
  async confirmUnsubscribe(@Param('token') token: string, @Res() res: Response): Promise<void> {
    const { firstName, campaignName } = await this.campaigns.unsubscribe(token);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(UNSUB_PAGE(firstName, campaignName, true));
  }
}
