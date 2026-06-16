import { Injectable, NotFoundException } from '@nestjs/common';
import archiver from 'archiver';
import type { Response } from 'express';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { redactCapped } from '../../common/audit/audit.util';
import { PrismaService } from '../../prisma/prisma.service';

export interface GdprExportBundle {
  user: unknown;
  contacts: { persons: unknown[]; organizations: unknown[] };
  deals: unknown[];
  activities: unknown[];
  emails: unknown[];
  tasks: unknown[];
  projects: unknown[];
  auditLogs: unknown[];
}

const README = `# DSGVO-Datenexport (Art. 20 DSGVO — Recht auf Datenübertragbarkeit)

Dieses Archiv enthält die zu Ihrem Benutzerkonto gespeicherten personenbezogenen
Daten im maschinenlesbaren JSON-Format.

## Inhalt
- user.json          — Ihr Benutzerprofil (Passwort/2FA-Geheimnisse entfernt)
- contacts.json      — von Ihnen betreute Personen + zugehörige Organisationen
- deals.json         — Ihre Deals (als Owner)
- activities.json    — Ihnen zugewiesene Aktivitäten
- emails.json        — Ihre synchronisierten E-Mails (Inhalt entschlüsselt)
- tasks.json         — Ihnen zugewiesene Aufgaben
- projects.json      — Projekte zu Ihren Deals
- audit-log.json     — Audit-Einträge zu Ihrem Konto

Erstellt am: {DATE}
Hinweis: Geheimnisse (Passwort-Hash, 2FA-Secret, OAuth-Token) sind aus Datenschutz-
gründen entfernt. Bei Fragen wenden Sie sich an Ihren Administrator.
`;

/**
 * Builds a DSGVO Art. 20 data-portability export scoped to a single data subject
 * (the user): the records they own/are assigned plus audit entries about them.
 */
@Injectable()
export class GdprService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async collectExport(userId: string): Promise<GdprExportBundle> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const [deals, activities, emailsRaw, tasks, projects, persons, organizations, auditLogs] =
      await Promise.all([
        this.prisma.deal.findMany({ where: { ownerId: userId, deletedAt: null } }),
        this.prisma.activity.findMany({ where: { assigneeId: userId, deletedAt: null } }),
        this.prisma.email.findMany({ where: { userId, deletedAt: null } }),
        this.prisma.task.findMany({ where: { assigneeId: userId } }),
        this.prisma.project.findMany({ where: { deletedAt: null, deal: { ownerId: userId } } }),
        this.prisma.person.findMany({ where: { ownerId: userId, deletedAt: null } }),
        this.prisma.organization.findMany({
          where: { deletedAt: null, persons: { some: { ownerId: userId } } },
        }),
        this.prisma.auditLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      ]);

    const emails = emailsRaw.map(({ bodyEncrypted, ...rest }) => ({
      ...rest,
      body: this.safeDecrypt(bodyEncrypted),
    }));

    return {
      user: redactCapped(user),
      contacts: { persons, organizations },
      deals,
      activities,
      emails,
      tasks,
      projects,
      auditLogs,
    };
  }

  /** Streams the bundle as a ZIP to the response without buffering the whole archive. */
  async writeArchive(bundle: GdprExportBundle, userId: string, res: Response): Promise<void> {
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="gdpr-export-${userId}.zip"`);
    archive.pipe(res);

    const json = (v: unknown): string => JSON.stringify(v, null, 2);
    archive.append(json(bundle.user), { name: 'user.json' });
    archive.append(json(bundle.contacts), { name: 'contacts.json' });
    archive.append(json(bundle.deals), { name: 'deals.json' });
    archive.append(json(bundle.activities), { name: 'activities.json' });
    archive.append(json(bundle.emails), { name: 'emails.json' });
    archive.append(json(bundle.tasks), { name: 'tasks.json' });
    archive.append(json(bundle.projects), { name: 'projects.json' });
    archive.append(json(bundle.auditLogs), { name: 'audit-log.json' });
    archive.append(README.replace('{DATE}', new Date().toISOString()), { name: 'README.md' });

    await archive.finalize();
  }

  private safeDecrypt(payload: string): string {
    try {
      return this.encryption.decrypt(payload);
    } catch {
      return '';
    }
  }
}
