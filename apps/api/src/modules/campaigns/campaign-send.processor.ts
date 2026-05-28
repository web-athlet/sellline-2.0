import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { CAMPAIGN_SEND_QUEUE, CampaignsService, type SendBatchJob } from './campaigns.service';

@Processor(CAMPAIGN_SEND_QUEUE)
export class CampaignSendProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignSendProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly campaigns: CampaignsService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'send-batch') {
      await this.processBatch(job.data as SendBatchJob);
    }
  }

  private async processBatch(data: SendBatchJob): Promise<void> {
    const { campaignId, contactIds, batchIndex, totalBatches } = data;

    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, deletedAt: null },
      select: { id: true, subject: true, bodyHtml: true, name: true },
    });
    if (!campaign) {
      this.logger.warn(`Campaign ${campaignId} not found — skipping batch ${batchIndex}`);
      return;
    }

    const contacts = await this.prisma.campaignContact.findMany({
      where: { id: { in: contactIds }, sentAt: null },
      include: {
        person: {
          select: { id: true, firstName: true, emails: true, org: { select: { name: true } } },
        },
      },
    });

    for (const contact of contacts) {
      const email = contact.person.emails[0];
      if (!email) continue;

      const html = this.campaigns.injectTracking(
        campaign.bodyHtml,
        campaignId,
        contact.personId,
        contact.person.firstName,
        contact.person.org?.name ?? '',
      );

      await this.mail.sendCampaignEmail(email, campaign.subject, html).catch((err: unknown) => {
        this.logger.warn(`Failed to send to contact ${contact.id}: ${err}`);
      });

      await this.prisma.campaignContact.update({
        where: { id: contact.id },
        data: { sentAt: new Date() },
      });
    }

    this.logger.log(`Batch ${batchIndex + 1}/${totalBatches} done (campaign=${campaignId})`);

    if (batchIndex === totalBatches - 1) {
      await this.campaigns.finalizeCampaignIfComplete(campaignId);
    }
  }
}
