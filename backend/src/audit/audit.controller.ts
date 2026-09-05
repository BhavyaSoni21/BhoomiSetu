import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// Admin-only (docs/FEATURE_AUDIT.md §8 item 10) - a platform-wide audit trail
// is an oversight tool, not something any individual officer needs to browse.
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(@Query('entityType') entityType?: string, @Query('userId') userId?: string) {
    return this.auditService.findAll({ entityType, userId });
  }
}
