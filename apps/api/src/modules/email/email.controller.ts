import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Redirect,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import type { AccessTokenPayload } from '../auth/auth.types';
import { Public } from '../auth/decorators/public.decorator';
import { QueryEmailsDto } from './dto/query-emails.dto';
import { SendEmailDto } from './dto/send-email.dto';
import { EmailService } from './email.service';
import { EmailSyncService } from './email-sync.service';

@Controller('api/v1/email')
export class EmailController {
  constructor(
    private readonly email: EmailService,
    private readonly sync: EmailSyncService,
  ) {}

  private userId(req: Request): string {
    return (req.user as AccessTokenPayload).sub;
  }

  // ─── Inbox / Threads ────────────────────────────────────────────────────

  @Get('threads')
  listThreads(@Req() req: Request, @Query() query: QueryEmailsDto) {
    return this.email.listThreads(this.userId(req), query);
  }

  @Get('threads/:threadId')
  getThread(@Req() req: Request, @Param('threadId') threadId: string) {
    return this.email.getThread(threadId, this.userId(req));
  }

  @Get('threads/:threadId/summary')
  summarizeThread(@Req() req: Request, @Param('threadId') threadId: string) {
    return this.email.summarizeThread(threadId, this.userId(req));
  }

  @Get('count')
  getCount(@Req() req: Request) {
    return this.email.getUnreadCount(this.userId(req));
  }

  // ─── Send ────────────────────────────────────────────────────────────────

  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  send(@Req() req: Request, @Body() dto: SendEmailDto) {
    return this.email.sendEmail(this.userId(req), dto);
  }

  // ─── Provider Status ─────────────────────────────────────────────────────

  @Get('providers')
  getProviders(@Req() req: Request) {
    return this.email.getProviders(this.userId(req));
  }

  // ─── Gmail OAuth ─────────────────────────────────────────────────────────

  @Get('gmail/connect-url')
  getGmailConnectUrl(@Req() req: Request) {
    const url = this.sync.buildGmailConnectUrl(this.userId(req));
    return { url };
  }

  @Public()
  @Get('gmail/callback')
  @Redirect()
  async gmailCallback(@Query('code') code: string, @Query('state') state: string) {
    await this.sync.handleGmailCallback(code, state);
    const webUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    return { url: `${webUrl}/settings?provider=gmail&status=connected` };
  }

  @Delete('gmail/disconnect')
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnectGmail(@Req() req: Request) {
    return this.sync.disconnectGmail(this.userId(req));
  }

  // ─── Outlook OAuth ────────────────────────────────────────────────────────

  @Get('outlook/connect-url')
  getOutlookConnectUrl(@Req() req: Request) {
    const url = this.sync.buildOutlookConnectUrl(this.userId(req));
    return { url };
  }

  @Public()
  @Get('outlook/callback')
  @Redirect()
  async outlookCallback(@Query('code') code: string, @Query('state') state: string) {
    await this.sync.handleOutlookCallback(code, state);
    const webUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    return { url: `${webUrl}/settings?provider=outlook&status=connected` };
  }

  @Delete('outlook/disconnect')
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnectOutlook(@Req() req: Request) {
    return this.sync.disconnectOutlook(this.userId(req));
  }
}
