import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nextgen/db';
import DOMPurify from 'isomorphic-dompurify';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';

interface RawField {
  label?: unknown;
  placeholder?: unknown;
  [key: string]: unknown;
}

function sanitizeSchema(fields: unknown[]): unknown[] {
  return fields.map((field) => {
    const f = field as RawField;
    return {
      ...f,
      ...(typeof f.label === 'string'
        ? { label: DOMPurify.sanitize(f.label, { USE_PROFILES: { html: true } }) }
        : {}),
      ...(typeof f.placeholder === 'string'
        ? { placeholder: DOMPurify.sanitize(f.placeholder, { USE_PROFILES: { html: true } }) }
        : {}),
    };
  });
}

const FORM_LIST_SELECT = {
  id: true,
  name: true,
  isActive: true,
  submissions: true,
  notifyEmails: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FormSelect;

@Injectable()
export class FormsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFormDto) {
    return this.prisma.form.create({
      data: {
        name: dto.name,
        schemaJson: sanitizeSchema(dto.schemaJson) as Prisma.InputJsonValue,
        notifyEmails: dto.notifyEmails ?? [],
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll() {
    return this.prisma.form.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: FORM_LIST_SELECT,
    });
  }

  async findOne(id: string) {
    const form = await this.prisma.form.findFirst({
      where: { id, deletedAt: null },
    });
    if (!form) throw new NotFoundException(`Form ${id} not found`);
    return form;
  }

  async update(id: string, dto: UpdateFormDto) {
    await this.findOne(id);
    return this.prisma.form.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.schemaJson !== undefined
          ? { schemaJson: sanitizeSchema(dto.schemaJson) as Prisma.InputJsonValue }
          : {}),
        ...(dto.notifyEmails !== undefined ? { notifyEmails: dto.notifyEmails } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.form.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async getEmbed(id: string) {
    const form = await this.findOne(id);
    const webUrl = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
    const embedUrl = `${webUrl}/f/${id}`;
    return {
      formId: id,
      formName: form.name,
      embedUrl,
      snippet: `<iframe src="${embedUrl}" width="100%" height="600px" frameborder="0" title="${form.name}"></iframe>`,
    };
  }
}
