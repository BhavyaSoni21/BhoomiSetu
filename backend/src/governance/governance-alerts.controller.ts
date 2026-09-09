import { Controller, Get, Patch, Body, Param, Query, ParseUUIDPipe, NotFoundException, UseGuards } from '@nestjs/common';
import { GovernanceAlertsService } from './governance-alerts.service';
import { UpdateGovernanceAlertStatusDto } from './dto/governance-alert.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ALL_STAFF_ROLES } from '../auth/roles.constants';
import { User } from '../users/user.entity';
import { AuditService } from '../audit/audit.service';

// Officer/admin-only throughout (docs/FEATURE_AUDIT.md §8 item 5) - there is
// no citizen-facing use of governance alerts anywhere in the frontend.
@Controller('governance-alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ALL_STAFF_ROLES)
export class GovernanceAlertsController {
  constructor(
    private readonly alertsService: GovernanceAlertsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async findAll(@Query('status') status?: string, @Query('severity') severity?: string) {
    return this.alertsService.findAll({ status, severity });
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const alert = await this.alertsService.findOne(id);
    if (!alert) throw new NotFoundException(`Governance alert not found: ${id}`);
    return alert;
  }

  @Patch(':id/status')
  async updateStatus(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGovernanceAlertStatusDto) {
    const alert = await this.alertsService.updateStatus(id, dto.status, dto.reason);
    if (!alert) throw new NotFoundException(`Governance alert not found: ${id}`);
    await this.auditService.log({
      userId: user.id,
      userRole: user.role,
      action: 'GOVERNANCE_ALERT_STATUS_CHANGED',
      entityType: 'GOVERNANCE_ALERT',
      entityId: id,
      parcelId: alert.parcelId,
      metadata: { status: dto.status, reason: dto.reason },
    });
    return alert;
  }
}
