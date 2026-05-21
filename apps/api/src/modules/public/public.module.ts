import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { PublicController } from './public.controller';

@Module({
  imports: [LeadsModule],
  controllers: [PublicController],
})
export class PublicModule {}
