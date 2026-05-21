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
import { ProjectsService } from './projects.service';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Controller({ path: 'projects', version: '1' })
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  findAll(@Query() query: QueryProjectsDto) {
    return this.projects.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.projects.create(dto);
  }

  // Must come before :id to avoid route shadowing
  @Get('templates')
  getTemplates() {
    return this.projects.getTemplates();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projects.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.projects.remove(id);
  }

  @Patch(':id/status')
  changeStatus(@Param('id') id: string, @Body() dto: ChangeStatusDto) {
    return this.projects.changeStatus(id, dto);
  }

  @Post(':id/from-template')
  @HttpCode(HttpStatus.OK)
  createFromTemplate(@Param('id') id: string, @Body('templateId') templateId: string) {
    return this.projects.createFromTemplate(id, templateId);
  }

  @Post(':id/tasks')
  createTask(@Param('id') projectId: string, @Body() dto: CreateTaskDto) {
    return this.projects.createTask(projectId, dto);
  }
}
