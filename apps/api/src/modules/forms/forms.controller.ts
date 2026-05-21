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
  Put,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { FormsService } from './forms.service';

@Controller({ path: 'forms', version: '1' })
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  @Roles('ADMIN', 'MANAGER')
  @Post()
  create(@Body() dto: CreateFormDto) {
    return this.forms.create(dto);
  }

  @Get()
  findAll() {
    return this.forms.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.forms.findOne(id);
  }

  @Get(':id/embed')
  getEmbed(@Param('id', ParseUUIDPipe) id: string) {
    return this.forms.getEmbed(id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFormDto) {
    return this.forms.update(id, dto);
  }

  @Roles('ADMIN', 'MANAGER')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.forms.remove(id);
  }
}
