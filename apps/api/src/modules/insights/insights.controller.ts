import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@nextgen/db';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { QueryReportDto } from './dto/query-report.dto';
import { InsightsService } from './insights.service';

const VALID_REPORT_TYPES = [
  'dealConversionRate',
  'revenueForecast',
  'activityPerformance',
  'wonVsLostDeals',
  'pipelineVelocity',
  'leadSources',
  'emailPerformance',
  'revenueByUser',
] as const;

@Controller({ path: 'insights', version: '1' })
@UseGuards(RolesGuard)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('reports/:type')
  async getReport(@Param('type') type: string, @Query() query: QueryReportDto) {
    if (!VALID_REPORT_TYPES.includes(type as (typeof VALID_REPORT_TYPES)[number])) {
      throw new BadRequestException(`Unknown report type: ${type}`);
    }
    return this.insights.getReport(type, query);
  }

  @Get('loss-analysis')
  getLatestLossInsight() {
    return this.insights.getLatestLossInsight();
  }

  @Post('loss-analysis/trigger')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.MANAGER)
  triggerLossAnalysis() {
    return this.insights.triggerLossAnalysis();
  }
}
