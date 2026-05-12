import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingConfigDto } from './dto/update-booking-config.dto';

@Controller({ path: 'booking', version: '1' })
export class BookingController {
  constructor(private readonly booking: BookingService) {}

  @Get('config')
  getConfig(@CurrentUser() user: AuthenticatedUser) {
    return this.booking.getConfig(user);
  }

  @Patch('config')
  updateConfig(@Body() dto: UpdateBookingConfigDto, @CurrentUser() user: AuthenticatedUser) {
    return this.booking.updateConfig(dto, user);
  }

  @Post('config/generate-slug')
  @HttpCode(HttpStatus.OK)
  generateSlug(@CurrentUser() user: AuthenticatedUser) {
    return this.booking.generateSlug(user);
  }

  @Public()
  @Get('public/:slug')
  getPublicProfile(@Param('slug') slug: string) {
    return this.booking.getPublicProfile(slug);
  }

  @Public()
  @Get('public/:slug/slots')
  getAvailableSlots(@Param('slug') slug: string, @Query('date') date: string) {
    return this.booking.getAvailableSlots(slug, date);
  }

  @Public()
  @Post('public/:slug/book')
  @HttpCode(HttpStatus.CREATED)
  createBooking(@Param('slug') slug: string, @Body() dto: CreateBookingDto) {
    return this.booking.createBooking(slug, dto);
  }
}
