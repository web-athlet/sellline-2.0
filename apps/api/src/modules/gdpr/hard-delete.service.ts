import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { subDays } from 'date-fns';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_GRACE_DAYS = 30;

export interface HardDeleteResult {
  persons: number;
  leads: number;
}

/**
 * DSGVO Art. 17 (Recht auf Löschung): soft-deleted PII is permanently purged after
 * a grace window. Disabled by default (GDPR_HARD_DELETE_ENABLED) because the deletion
 * is irreversible. Each record is recorded in the audit log (without re-storing the
 * erased PII) before deletion, and children are removed in FK-safe order.
 */
@Injectable()
export class HardDeleteService {
  private readonly logger = new Logger(HardDeleteService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * *', { timeZone: 'UTC' })
  async hardDeleteCron(): Promise<void> {
    await this.run();
  }

  async run(): Promise<HardDeleteResult> {
    if (process.env.GDPR_HARD_DELETE_ENABLED !== 'true') {
      return { persons: 0, leads: 0 };
    }
    const graceDays = Number(process.env.GDPR_HARD_DELETE_GRACE_DAYS ?? DEFAULT_GRACE_DAYS);
    const cutoff = subDays(new Date(), Number.isFinite(graceDays) ? graceDays : DEFAULT_GRACE_DAYS);

    const persons = await this.purgePersons(cutoff);
    const leads = await this.purgeLeads(cutoff);

    if (persons || leads) {
      this.logger.log(`Hard-deleted ${persons} person(s), ${leads} lead(s) (grace ${graceDays}d)`);
    }
    return { persons, leads };
  }

  private async purgePersons(cutoff: Date): Promise<number> {
    const persons = await this.prisma.person.findMany({
      where: { deletedAt: { lte: cutoff } },
      select: { id: true, deletedAt: true },
    });
    if (persons.length === 0) return 0;

    await this.auditBeforeDelete('Person', persons);

    const ids = persons.map((p) => p.id);
    // FK-safe order: unlink optional Activity references first, then delete the
    // Person. Implicit M2M (DealParticipants) join rows + cascading CampaignContacts
    // are removed by the DB automatically.
    await this.prisma.$transaction([
      this.prisma.activity.updateMany({
        where: { personId: { in: ids } },
        data: { personId: null },
      }),
      this.prisma.person.deleteMany({ where: { id: { in: ids } } }),
    ]);
    return ids.length;
  }

  private async purgeLeads(cutoff: Date): Promise<number> {
    const leads = await this.prisma.lead.findMany({
      where: { deletedAt: { lte: cutoff } },
      select: { id: true, deletedAt: true },
    });
    if (leads.length === 0) return 0;

    await this.auditBeforeDelete('Lead', leads);
    const ids = leads.map((l) => l.id);
    await this.prisma.lead.deleteMany({ where: { id: { in: ids } } });
    return ids.length;
  }

  private async auditBeforeDelete(
    tableName: string,
    rows: { id: string; deletedAt: Date | null }[],
  ): Promise<void> {
    // Deliberately store only identifiers + timestamps — re-persisting the erased
    // PII into the audit log would defeat the erasure.
    await this.prisma.auditLog.createMany({
      data: rows.map((r) => ({
        action: 'HARD_DELETE',
        tableName,
        recordId: r.id,
        changes: { softDeletedAt: r.deletedAt?.toISOString() ?? null },
      })),
    });
  }
}
