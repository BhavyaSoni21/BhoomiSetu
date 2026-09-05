import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GovernanceAlert } from './governance-alert.entity';
import { GovernanceAlertsController } from './governance-alerts.controller';
import { GovernanceAlertsService } from './governance-alerts.service';

@Module({
  imports: [TypeOrmModule.forFeature([GovernanceAlert])],
  controllers: [GovernanceAlertsController],
  providers: [GovernanceAlertsService],
  // Exported so AiModule's alert-explanation endpoint (Phase 8) can look up
  // an alert without duplicating this repository/query.
  exports: [GovernanceAlertsService],
})
export class GovernanceModule {}
