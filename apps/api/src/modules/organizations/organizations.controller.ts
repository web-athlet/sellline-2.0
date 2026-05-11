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
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { QueryOrganizationsDto } from './dto/query-organizations.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller({ path: 'organizations', version: '1' })
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Get()
  findAll(@Query() query: QueryOrganizationsDto) {
    return this.orgs.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateOrganizationDto) {
    return this.orgs.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orgs.findOne(id);
  }

  @Get(':id/tree')
  getTree(@Param('id') id: string) {
    return this.orgs.findTree(id);
  }

  @Get(':id/persons')
  getPersons(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.orgs.findPersons(id, page, limit);
  }

  @Get(':id/deals')
  getDeals(@Param('id') id: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.orgs.findDeals(id, page, limit);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.orgs.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.orgs.remove(id);
  }
}
