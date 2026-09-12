import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PredictiveAnalyticsService } from './predictive-analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// Admin-only (docs/FEATURE_AUDIT.md §8 item 5) - only the Admin Portal's
// TopRiskParcels calls this. The single-parcel GET /parcels/:id/risk-score
// route lives on ParcelsController instead and stays public - it's shown to
// citizens on Parcel 360.
@Controller('predictive-analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PredictiveAnalyticsController {
  constructor(private readonly predictiveAnalyticsService: PredictiveAnalyticsService) {}

  @Get('top-risk-parcels')
  async getTopRiskParcels(@Query('limit') limit?: string) {
    return this.predictiveAnalyticsService.getTopRiskParcels(limit !== undefined ? Number(limit) : undefined);
  }
}
