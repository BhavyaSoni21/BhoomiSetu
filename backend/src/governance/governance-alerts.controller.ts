import { Controller, Get, Patch, Body, Param, Query, ParseUUIDPipe, NotFoundException } from '@nestjs/common';
import { GovernanceAlertsService } from './governance-alerts.service';
import { UpdateGovernanceAlertStatusDto } from './dto/governance-alert.dto';

@Controller('governance-alerts')
export class GovernanceAlertsController {
  constructor(private readonly alertsService: GovernanceAlertsService) {}

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
  async updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGovernanceAlertStatusDto) {
    const alert = await this.alertsService.updateStatus(id, dto.status);
    if (!alert) throw new NotFoundException(`Governance alert not found: ${id}`);
    return alert;
  }
}
