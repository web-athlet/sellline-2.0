import { Controller, Get, Param } from '@nestjs/common';
import { PipelinesService } from './pipelines.service';

@Controller({ path: 'pipelines', version: '1' })
export class PipelinesController {
  constructor(private readonly pipelines: PipelinesService) {}

  @Get()
  findAll() {
    return this.pipelines.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pipelines.findOne(id);
  }

  @Get(':id/summary')
  summary(@Param('id') id: string) {
    return this.pipelines.summary(id);
  }
}
