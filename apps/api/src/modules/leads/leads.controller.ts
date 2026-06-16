import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@nextgen/db';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { LeadsService } from './leads.service';

@Controller({ path: 'leads', version: '1' })
@UseGuards(RolesGuard)
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  findAll(@Query() query: QueryLeadsDto) {
    return this.leads.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.leads.findOne(id);
  }

  @Post(':id/convert')
  @Roles(Role.ADMIN, Role.MANAGER)
  convert(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ConvertLeadDto) {
    return this.leads.convert(id, dto);
  }

  @Post(':id/enrich')
  @Roles(Role.ADMIN, Role.MANAGER)
  reEnqueue(@Param('id', ParseUUIDPipe) id: string) {
    return this.leads.reEnqueue(id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.leads.remove(id);
  }
}
