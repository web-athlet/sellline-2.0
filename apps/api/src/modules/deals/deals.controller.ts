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
import { DealsService } from './deals.service';
import { ChangeStageDto } from './dto/change-stage.dto';
import { CreateDealDto } from './dto/create-deal.dto';
import { LostDealDto } from './dto/lost-deal.dto';
import { QueryDealsDto } from './dto/query-deals.dto';
import { SnoozeGhostingDto } from './dto/snooze-ghosting.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { UpsertDealProductDto } from './dto/upsert-deal-product.dto';

@Controller({ path: 'deals', version: '1' })
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Get()
  findAll(@Query() query: QueryDealsDto) {
    return this.deals.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateDealDto, @CurrentUser() user: AuthenticatedUser) {
    return this.deals.create(dto, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deals.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDealDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.deals.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.deals.remove(id, user);
  }

  @Patch(':id/stage')
  changeStage(
    @Param('id') id: string,
    @Body() dto: ChangeStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.deals.changeStage(id, dto, user);
  }

  @Post(':id/won')
  @HttpCode(HttpStatus.OK)
  markWon(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.deals.markWon(id, user);
  }

  @Post(':id/lost')
  @HttpCode(HttpStatus.OK)
  markLost(
    @Param('id') id: string,
    @Body() dto: LostDealDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.deals.markLost(id, dto, user);
  }

  @Post(':id/snooze-ghosting')
  @HttpCode(HttpStatus.OK)
  snoozeGhosting(
    @Param('id') id: string,
    @Body() dto: SnoozeGhostingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.deals.snoozeGhosting(id, dto, user);
  }

  @Get(':id/products')
  getProducts(@Param('id') id: string) {
    return this.deals.getProducts(id);
  }

  @Post(':id/products')
  addProduct(
    @Param('id') id: string,
    @Body() dto: UpsertDealProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.deals.addProduct(id, dto, user);
  }

  @Delete(':id/products/:dealProductId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeProduct(
    @Param('id') id: string,
    @Param('dealProductId') dealProductId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.deals.removeProduct(id, dealProductId, user);
  }
}
