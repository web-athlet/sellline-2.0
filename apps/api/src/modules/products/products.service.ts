import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nextgen/db';
import Papa from 'papaparse';
import { Readable } from 'node:stream';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

export interface ImportError {
  row: number;
  msg: string;
}

export interface ImportResult {
  created: number;
  errors: ImportError[];
}

const PRODUCT_SELECT = {
  id: true,
  name: true,
  code: true,
  category: true,
  unit: true,
  billingFreq: true,
  price: true,
  taxPct: true,
  currency: true,
  visibleFor: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryProductsDto) {
    const { page = 1, limit = 50, category, search } = query;

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
        select: PRODUCT_SELECT,
      }),
    ]);

    return {
      data: products,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: PRODUCT_SELECT,
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async create(dto: CreateProductDto) {
    if (dto.code) {
      await this.assertCodeUnique(dto.code);
    }
    return this.prisma.product.create({
      data: {
        name: dto.name,
        code: dto.code ?? null,
        category: dto.category ?? null,
        unit: dto.unit ?? null,
        billingFreq: dto.billingFreq ?? null,
        price: dto.price,
        taxPct: dto.taxPct ?? 0,
        currency: dto.currency ?? 'EUR',
        visibleFor: dto.visibleFor ?? [],
      },
      select: PRODUCT_SELECT,
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    if (dto.code !== undefined) {
      await this.assertCodeUnique(dto.code, id);
    }
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        ...(dto.billingFreq !== undefined ? { billingFreq: dto.billingFreq } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.taxPct !== undefined ? { taxPct: dto.taxPct } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.visibleFor !== undefined ? { visibleFor: dto.visibleFor } : {}),
      },
      select: PRODUCT_SELECT,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async importCsv(fileBuffer: Buffer): Promise<ImportResult> {
    const errors: ImportError[] = [];
    let createdCount = 0;
    let rowNumber = 0;

    return new Promise((resolve, reject) => {
      Papa.parse(Readable.from(fileBuffer) as unknown as File, {
        header: true,
        worker: false,
        step: (row: Papa.ParseStepResult<Record<string, string>>, parser) => {
          rowNumber++;
          if (rowNumber > 5000) {
            parser.abort();
            errors.push({ row: rowNumber, msg: 'Limit 5000 Zeilen überschritten' });
            return;
          }
          parser.pause();
          void this.createFromCsvRow(row.data)
            .then(() => {
              createdCount++;
            })
            .catch((e: Error) => {
              errors.push({ row: rowNumber, msg: e.message });
            })
            .finally(() => {
              parser.resume();
            });
        },
        complete: () => resolve({ created: createdCount, errors }),
        error: (err: Error) => reject(err),
      });
    });
  }

  private async createFromCsvRow(data: Record<string, string>): Promise<void> {
    const name = data['name']?.trim();
    if (!name) throw new Error('name ist erforderlich');

    const priceStr = data['price']?.trim();
    if (!priceStr) throw new Error('price ist erforderlich');
    const price = parseFloat(priceStr);
    if (isNaN(price) || price < 0) throw new Error(`Ungültiger Preis: ${priceStr}`);

    const taxPctStr = data['taxPct']?.trim();
    const taxPct = taxPctStr ? parseFloat(taxPctStr) : 0;
    if (isNaN(taxPct)) throw new Error(`Ungültige Steuer: ${taxPctStr ?? ''}`);

    const code = data['code']?.trim() || null;
    if (code) {
      const existing = await this.prisma.product.findFirst({
        where: { code, deletedAt: null },
        select: { id: true },
      });
      if (existing) throw new Error(`Code '${code}' bereits vergeben`);
    }

    await this.prisma.product.create({
      data: {
        name,
        code,
        category: data['category']?.trim() || null,
        unit: data['unit']?.trim() || null,
        billingFreq: data['billingFreq']?.trim() || null,
        price,
        taxPct,
        currency: data['currency']?.trim() || 'EUR',
        visibleFor: data['visibleFor']
          ? data['visibleFor']
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      },
      select: { id: true },
    });
  }

  private async assertCodeUnique(code: string | undefined, excludeId?: string): Promise<void> {
    if (!code) return;
    const existing = await this.prisma.product.findFirst({
      where: {
        code,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) throw new ConflictException(`Product code '${code}' is already in use`);
  }
}
