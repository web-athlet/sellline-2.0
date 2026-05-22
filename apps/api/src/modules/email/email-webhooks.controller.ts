import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { EmailSyncService } from './email-sync.service';

interface GmailPubSubBody {
  message?: {
    data?: string;
    messageId?: string;
  };
  subscription?: string;
}

interface OutlookNotification {
  value?: Array<{
    clientState?: string;
    resource?: string;
    resourceData?: { id?: string };
    subscriptionId?: string;
  }>;
}

@Public()
@Controller('api/v1/webhooks')
export class EmailWebhooksController {
  private readonly logger = new Logger(EmailWebhooksController.name);

  constructor(private readonly sync: EmailSyncService) {}

  // ─── Gmail PubSub Webhook ─────────────────────────────────────────────────

  @Post('gmail')
  @HttpCode(HttpStatus.OK)
  async handleGmailWebhook(
    @Body() body: GmailPubSubBody,
    @Headers('authorization') authHeader: string,
  ): Promise<{ ok: boolean }> {
    const token = authHeader?.replace('Bearer ', '');

    const valid = await this.sync.verifyPubSubToken(token);
    if (!valid) {
      this.logger.warn('Gmail webhook: invalid PubSub token');
      throw new UnauthorizedException('Invalid PubSub token');
    }

    if (!body.message?.data) return { ok: true };

    try {
      const data = JSON.parse(Buffer.from(body.message.data, 'base64').toString('utf8')) as {
        emailAddress?: string;
        historyId?: string;
      };

      if (data.emailAddress && data.historyId) {
        // ACK immediately, process async
        await this.sync.enqueueGmailSync(data.emailAddress, data.historyId);
      }
    } catch (err) {
      this.logger.warn(`Gmail webhook parse error: ${err}`);
    }

    return { ok: true };
  }

  // ─── Outlook Graph Webhook ────────────────────────────────────────────────

  @Post('outlook')
  async handleOutlookWebhook(
    @Query('validationToken') validationToken: string | undefined,
    @Body() body: OutlookNotification,
    @Res() res: Response,
  ): Promise<void> {
    // Microsoft sends validationToken on subscription creation — echo it back as plain text
    if (validationToken) {
      res.setHeader('Content-Type', 'text/plain');
      res.status(200).send(validationToken);
      return;
    }

    // Process change notifications asynchronously
    for (const notification of body.value ?? []) {
      const messageId = notification.resourceData?.id;
      if (!messageId) continue;

      // Recover userId from subscription clientState
      // The clientState was set to a state token containing the userId
      const clientState = notification.clientState;
      if (!clientState) continue;

      // Find user by subscriptionId
      const subscriptionId = notification.subscriptionId;
      if (!subscriptionId) continue;

      const user = await this.sync['prisma'].user
        .findFirst({
          where: { outlookSubscriptionId: subscriptionId },
          select: { id: true },
        })
        .catch(() => null);

      if (user) {
        await this.sync['syncQueue']
          .add('outlook', { type: 'outlook', userId: user.id, messageId })
          .catch((err) => this.logger.warn(`Outlook enqueue failed: ${err}`));
      }
    }

    res.status(202).send();
  }
}
