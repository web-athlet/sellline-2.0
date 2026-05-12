import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { ActivitiesService } from './activities.service';
import { CheckConflictsDto } from './dto/check-conflicts.dto';
import { CreateActivityDto } from './dto/create-activity.dto';
import { QueryActivitiesDto } from './dto/query-activities.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@Controller({ path: 'activities', version: '1' })
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get()
  findAll(@Query() query: QueryActivitiesDto) {
    return this.activities.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateActivityDto, @CurrentUser() user: AuthenticatedUser) {
    return this.activities.create(dto, user);
  }

  @Post('check-conflicts')
  @HttpCode(HttpStatus.OK)
  checkConflicts(@Body() dto: CheckConflictsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.activities.checkConflicts(dto, user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.activities.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateActivityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.activities.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.activities.remove(id, user);
  }

  @Patch(':id/done')
  @HttpCode(HttpStatus.OK)
  markDone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.activities.markDone(id, user);
  }
}
