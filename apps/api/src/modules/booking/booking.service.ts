import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ActivityType } from '@nextgen/db';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingConfigDto } from './dto/update-booking-config.dto';

const DEFAULT_CONFIG = {
  slotDuration: 30,
  workdayStart: 9,
  workdayEnd: 17,
  timezone: 'Europe/Berlin',
  activeDays: [1, 2, 3, 4, 5],
};

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getConfig(user: AuthenticatedUser) {
    const config = await this.prisma.bookingConfig.findFirst({
      where: { userId: user.id, deletedAt: null },
    });
    const userData = await this.prisma.user.findFirst({
      where: { id: user.id, deletedAt: null },
      select: { bookingSlug: true, name: true },
    });
    return {
      ...(config ?? { ...DEFAULT_CONFIG, userId: user.id }),
      bookingSlug: userData?.bookingSlug ?? null,
      name: userData?.name ?? '',
      bookingUrl: userData?.bookingSlug ? `/book/${userData.bookingSlug}` : null,
    };
  }

  async updateConfig(dto: UpdateBookingConfigDto, user: AuthenticatedUser) {
    const config = await this.prisma.bookingConfig.upsert({
      where: { userId: user.id },
      update: {
        ...(dto.slotDuration !== undefined ? { slotDuration: dto.slotDuration } : {}),
        ...(dto.workdayStart !== undefined ? { workdayStart: dto.workdayStart } : {}),
        ...(dto.workdayEnd !== undefined ? { workdayEnd: dto.workdayEnd } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.activeDays !== undefined ? { activeDays: dto.activeDays } : {}),
      },
      create: {
        userId: user.id,
        slotDuration: dto.slotDuration ?? DEFAULT_CONFIG.slotDuration,
        workdayStart: dto.workdayStart ?? DEFAULT_CONFIG.workdayStart,
        workdayEnd: dto.workdayEnd ?? DEFAULT_CONFIG.workdayEnd,
        timezone: dto.timezone ?? DEFAULT_CONFIG.timezone,
        activeDays: dto.activeDays ?? DEFAULT_CONFIG.activeDays,
      },
    });
    return config;
  }

  async generateSlug(user: AuthenticatedUser) {
    const existing = await this.prisma.user.findFirst({
      where: { id: user.id, deletedAt: null },
      select: { bookingSlug: true, name: true },
    });
    if (existing?.bookingSlug) {
      return { bookingSlug: existing.bookingSlug };
    }
    const base = (existing?.name ?? 'user')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    const slug = `${base}-${Date.now().toString(36)}`;
    await this.prisma.user.update({ where: { id: user.id }, data: { bookingSlug: slug } });
    return { bookingSlug: slug };
  }

  async getPublicProfile(slug: string) {
    const user = await this.prisma.user.findFirst({
      where: { bookingSlug: slug, deletedAt: null },
      select: { id: true, name: true, avatarUrl: true },
    });
    if (!user) throw new NotFoundException(`Booking page not found`);
    const config = await this.prisma.bookingConfig.findFirst({
      where: { userId: user.id, deletedAt: null },
    });
    return {
      userId: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      config: config ?? DEFAULT_CONFIG,
    };
  }

  async getAvailableSlots(slug: string, dateStr: string) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) throw new BadRequestException('Invalid date');

    const user = await this.prisma.user.findFirst({
      where: { bookingSlug: slug, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundException(`Booking page not found`);

    const config = await this.prisma.bookingConfig.findFirst({
      where: { userId: user.id, deletedAt: null },
    });
    const cfg = config ?? DEFAULT_CONFIG;

    const dayOfWeek = date.getDay();
    if (!(cfg.activeDays as number[]).includes(dayOfWeek)) return { slots: [] };

    const dayStart = new Date(date);
    dayStart.setHours(cfg.workdayStart, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(cfg.workdayEnd, 0, 0, 0);

    const existing = await this.prisma.activity.findMany({
      where: {
        assigneeId: user.id,
        type: ActivityType.MEETING,
        done: false,
        deletedAt: null,
        startTime: { gte: dayStart, lt: dayEnd },
      },
      select: { startTime: true, endTime: true },
    });

    const slots: Array<{ startTime: string; endTime: string }> = [];
    const duration = cfg.slotDuration * 60_000;
    let cursor = dayStart.getTime();

    while (cursor + duration <= dayEnd.getTime()) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor + duration);
      const overlaps = existing.some((e) => {
        if (!e.startTime || !e.endTime) return false;
        return e.startTime < slotEnd && e.endTime > slotStart;
      });
      if (!overlaps) {
        slots.push({ startTime: slotStart.toISOString(), endTime: slotEnd.toISOString() });
      }
      cursor += duration;
    }

    return { slots };
  }

  async createBooking(slug: string, dto: CreateBookingDto) {
    const user = await this.prisma.user.findFirst({
      where: { bookingSlug: slug, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundException(`Booking page not found`);

    const start = new Date(dto.startTime);
    const config = await this.prisma.bookingConfig.findFirst({
      where: { userId: user.id, deletedAt: null },
    });
    const duration = (config?.slotDuration ?? 30) * 60_000;
    const end = new Date(start.getTime() + duration);

    // W-1: atomic conflict check + create to prevent TOCTOU race
    const activity = await this.prisma.$transaction(async (tx) => {
      const conflict = await tx.activity.findFirst({
        where: {
          assigneeId: user.id,
          type: ActivityType.MEETING,
          done: false,
          deletedAt: null,
          AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
        },
        select: { id: true },
      });
      if (conflict) throw new BadRequestException('Der gewählte Slot ist nicht mehr verfügbar');

      return tx.activity.create({
        data: {
          type: ActivityType.MEETING,
          subject: dto.subject,
          notes: dto.guestNotes
            ? `Gebucht von: ${dto.guestName} (${dto.guestEmail})\n${dto.guestNotes}`
            : `Gebucht von: ${dto.guestName} (${dto.guestEmail})`,
          startTime: start,
          endTime: end,
          dueDate: start,
          assigneeId: user.id,
        },
        select: { id: true, subject: true, startTime: true, endTime: true },
      });
    });

    // W-3: log without PII
    this.logger.log({ msg: 'booking.created', activityId: activity.id, userId: user.id });
    return { activityId: activity.id, startTime: activity.startTime, endTime: activity.endTime };
  }
}
