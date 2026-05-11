import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { QueryPulseFeedDto } from './dto/query-pulse-feed.dto';
import { PulseFeedService } from './pulse-feed.service';

@Controller({ path: 'pulse-feed', version: '1' })
export class PulseFeedController {
  constructor(private readonly pulseFeed: PulseFeedService) {}

  @Get()
  getFeed(@Query() query: QueryPulseFeedDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pulseFeed.getFeed(query, user);
  }

  @Get('counts')
  getCounts(@Query('date') date: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.pulseFeed.getCounts(date, user);
  }

  @Patch('activity/:id/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  completeActivity(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.pulseFeed.completeActivity(id, user);
  }
}
