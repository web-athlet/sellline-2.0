import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly webUrl = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';

  async sendPasswordResetMail(email: string, rawToken: string): Promise<void> {
    const resetUrl = `${this.webUrl}/reset-password?token=${rawToken}`;
    this.logger.log(
      `[MAIL_STUB] password-reset to=${this.maskEmail(email)} url=${resetUrl} (real SMTP wired in Session 12)`,
    );
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***';
    const head = local.length <= 2 ? local[0] : local.slice(0, 2);
    return `${head}***@${domain}`;
  }
}
