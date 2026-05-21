import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller({ path: 'tasks', version: '1' })
export class TasksController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  findAll(@Query() query: QueryTasksDto) {
    return this.projects.findTasks(query);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.projects.updateTask(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.projects.removeTask(id);
  }
}
