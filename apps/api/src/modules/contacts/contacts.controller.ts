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
} from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { MergeContactsDto } from './dto/merge-contacts.dto';
import { QueryContactsDto } from './dto/query-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Controller({ path: 'contacts', version: '1' })
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  findAll(@Query() query: QueryContactsDto) {
    return this.contacts.findAll(query);
  }

  @Get('duplicates')
  getDuplicates() {
    return this.contacts.findDuplicates();
  }

  @Post('merge')
  @HttpCode(HttpStatus.OK)
  merge(@Body() dto: MergeContactsDto) {
    return this.contacts.merge(dto);
  }

  @Post()
  create(@Body() dto: CreateContactDto, @CurrentUser() user: AuthenticatedUser) {
    return this.contacts.create(dto, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contacts.findOne(id);
  }

  @Get(':id/timeline')
  getTimeline(@Param('id') id: string) {
    return this.contacts.getTimeline(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contacts.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.contacts.remove(id);
  }
}
