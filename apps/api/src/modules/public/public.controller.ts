import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { LeadsService } from '../leads/leads.service';
import { SubmitFormDto } from './dto/submit-form.dto';

@Controller({ path: 'public/forms', version: '1' })
export class PublicController {
  constructor(private readonly leads: LeadsService) {}

  // Rate-limit: 5 submissions per IP per minute.
  // Access-Control-Allow-Origin: * so external sites can embed the form iframe.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(':id/submit')
  @HttpCode(HttpStatus.CREATED)
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Access-Control-Allow-Headers', 'Content-Type')
  submit(@Param('id', ParseUUIDPipe) formId: string, @Body() dto: SubmitFormDto) {
    return this.leads.submitPublic(formId, dto.data);
  }
}
