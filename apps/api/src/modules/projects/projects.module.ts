import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProjectsController } from './projects.controller';
import { TasksController } from './tasks.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectsController, TasksController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
