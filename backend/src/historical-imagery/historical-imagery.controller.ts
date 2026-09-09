import { Controller, Get, Post, Body, Param, ParseIntPipe, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { HistoricalComparisonService } from './historical-comparison.service';
import { CompareYearsDto } from './dto/compare.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ALL_STAFF_ROLES } from '../auth/roles.constants';

// Historical parcel-imagery comparison (docs/FRONTEND_UPGRADE_SPEC.md §8).
// listClusters/getParcelsForYear are public (2026-09-08, per the user's
// follow-up to embed the year-dropdown map in Parcel 360 for citizens too)
// - the underlying facts (dispute/restriction status) are already public
// via GET /parcels/:id/360's own Dispute/Restriction tabs, so this doesn't
// expose anything new. getImage/compare stay staff-only: compare has a real
// side effect (creates GovernanceAlert rows, costs a real LLM call) that
// only the Officer Portal's comparison workflow should be able to trigger.
@Controller('historical-imagery')
export class HistoricalImageryController {
  constructor(private readonly comparisonService: HistoricalComparisonService) {}

  @Get('clusters')
  async listClusters() {
    return this.comparisonService.listClusters();
  }

  // Real parcel geometry + category for one year, for rendering on the live
  // map (features/map/MapComponent.tsx) rather than the flat snapshot PNG.
  @Get('clusters/:clusterId/years/:year/parcels')
  async getParcelsForYear(@Param('clusterId') clusterId: string, @Param('year', ParseIntPipe) year: number) {
    return this.comparisonService.getParcelsForYear(clusterId, year);
  }

  @Get('clusters/:clusterId/years/:year/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALL_STAFF_ROLES)
  async getImage(@Param('clusterId') clusterId: string, @Param('year', ParseIntPipe) year: number, @Res() res: Response) {
    const buffer = await this.comparisonService.getSnapshotImage(clusterId, year);
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  }

  // Real side effect (creates GovernanceAlert rows), tighter rate limit
  // than the app default - same reasoning as change-detection/analyze.
  @Post('clusters/:clusterId/compare')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALL_STAFF_ROLES)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async compare(@Param('clusterId') clusterId: string, @Body() dto: CompareYearsDto) {
    return this.comparisonService.compare(clusterId, dto.fromYear, dto.toYear);
  }
}
