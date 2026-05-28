import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@nextgen/db';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CampaignsService, type SendGridBounceEvent } from './campaigns.service';
import { AddContactsDto } from './dto/add-contacts.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { QueryCampaignsDto } from './dto/query-campaigns.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller({ path: 'campaigns', version: '1' })
@UseGuards(RolesGuard)
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.MANAGER)
  create(@Body() dto: CreateCampaignDto, @CurrentUser() user: AuthenticatedUser) {
    return this.campaigns.create(dto, user.id);
  }

  @Get()
  findAll(@Query() query: QueryCampaignsDto) {
    return this.campaigns.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaigns.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaigns.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.MANAGER)
  remove(@Param('id') id: string) {
    return this.campaigns.remove(id);
  }

  // ─── Recipients ───────────────────────────────────────────────────────────

  @Post(':id/contacts')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.MANAGER)
  addContacts(@Param('id') id: string, @Body() dto: AddContactsDto) {
    return this.campaigns.addContacts(id, dto);
  }

  @Delete(':id/contacts/:personId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.MANAGER)
  removeContact(@Param('id') id: string, @Param('personId') personId: string) {
    return this.campaigns.removeContact(id, personId);
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  @Post(':id/send')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(Role.ADMIN, Role.MANAGER)
  send(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaigns.sendCampaign(id, user.id);
  }

  @Post(':id/test-send')
  @HttpCode(HttpStatus.OK)
  testSend(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaigns.testSend(id, user.id);
  }

  @Post(':id/ai-subjects')
  @HttpCode(HttpStatus.OK)
  generateAiSubjects(@Param('id') id: string) {
    return this.campaigns.generateAiSubjects(id);
  }

  // ─── SendGrid Bounce Webhook (@Public) ────────────────────────────────────

  @Public()
  @Post('webhooks/sendgrid')
  @HttpCode(HttpStatus.OK)
  handleSendGridBounce(@Body() events: SendGridBounceEvent[]) {
    return this.campaigns.handleSendGridBounce(Array.isArray(events) ? events : []);
  }
}
