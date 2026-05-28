import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly webUrl = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';

  async sendPasswordResetMail(email: string, rawToken: string): Promise<void> {
    const resetUrl = `${this.webUrl}/reset-password?token=${rawToken}`;
    this.logger.log(`[MAIL_STUB] password-reset to=${this.maskEmail(email)} url=${resetUrl}`);
  }

  async sendCampaignEmail(to: string, subject: string, _bodyHtml: string): Promise<void> {
    // Real SendGrid / SMTP transport wired in production
    this.logger.log(
      `[MAIL_STUB] campaign to=${this.maskEmail(to)} subject="${subject.slice(0, 40)}"`,
    );
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***';
    const head = local.length <= 2 ? local[0] : local.slice(0, 2);
    return `${head}***@${domain}`;
  }
}
