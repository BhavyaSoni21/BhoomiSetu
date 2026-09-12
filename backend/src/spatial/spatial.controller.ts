import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe, NotFoundException, HttpCode, UseGuards } from '@nestjs/common';
import { SpatialService } from './spatial.service';
import { CreateZoningOverlayDto, UpdateZoningOverlayDto } from './dto/zoning-overlay.dto';
import { CreateRestrictionZoneDto, UpdateRestrictionZoneDto } from './dto/restriction-zone.dto';
import { CreateInfrastructureFeatureDto, UpdateInfrastructureFeatureDto } from './dto/infrastructure-feature.dto';
import { CreateAdminMapNoteDto, UpdateAdminMapNoteDto } from './dto/admin-map-note.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/user.entity';

@Controller('gis')
export class SpatialController {
  constructor(private readonly spatialService: SpatialService) {}

  @Get('zoning-overlays')
  async getZoningOverlays(@Query('state') state?: string, @Query('district') district?: string) {
    return this.spatialService.findZoningOverlays({ state, district });
  }

  @Get('restriction-zones')
  async getRestrictionZones(@Query('state') state?: string, @Query('district') district?: string) {
    return this.spatialService.findRestrictionZones({ state, district });
  }

  @Get('infrastructure')
  async getInfrastructure(@Query('state') state?: string, @Query('district') district?: string) {
    return this.spatialService.findInfrastructure({ state, district });
  }

  @Get('change-detection-events')
  async getChangeDetectionEvents(@Query('state') state?: string, @Query('district') district?: string) {
    return this.spatialService.findChangeDetectionEvents({ state, district });
  }

  // Write endpoints below are admin-only (docs/FEATURE_AUDIT.md §8 item 13) -
  // maintaining reference/master spatial data, not a day-to-day officer
  // action, and no frontend UI calls these yet (no map-drawing tool exists
  // to genuinely author new zone geometry) - these exist as real, tested API
  // capability for whoever/whatever maintains this reference data.

  @Post('zoning-overlays')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createZoningOverlay(@Body() dto: CreateZoningOverlayDto) {
    return this.spatialService.createZoningOverlay(dto);
  }

  @Patch('zoning-overlays/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateZoningOverlay(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateZoningOverlayDto) {
    const row = await this.spatialService.updateZoningOverlay(id, dto);
    if (!row) throw new NotFoundException(`Zoning overlay not found: ${id}`);
    return row;
  }

  @Delete('zoning-overlays/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(204)
  async removeZoningOverlay(@Param('id', ParseUUIDPipe) id: string) {
    const deleted = await this.spatialService.removeZoningOverlay(id);
    if (!deleted) throw new NotFoundException(`Zoning overlay not found: ${id}`);
  }

  @Post('restriction-zones')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createRestrictionZone(@Body() dto: CreateRestrictionZoneDto) {
    return this.spatialService.createRestrictionZone(dto);
  }

  @Patch('restriction-zones/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateRestrictionZone(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRestrictionZoneDto) {
    const row = await this.spatialService.updateRestrictionZone(id, dto);
    if (!row) throw new NotFoundException(`Restriction zone not found: ${id}`);
    return row;
  }

  @Delete('restriction-zones/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(204)
  async removeRestrictionZone(@Param('id', ParseUUIDPipe) id: string) {
    const deleted = await this.spatialService.removeRestrictionZone(id);
    if (!deleted) throw new NotFoundException(`Restriction zone not found: ${id}`);
  }

  @Post('infrastructure')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createInfrastructureFeature(@Body() dto: CreateInfrastructureFeatureDto) {
    return this.spatialService.createInfrastructureFeature(dto);
  }

  @Patch('infrastructure/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateInfrastructureFeature(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInfrastructureFeatureDto) {
    const row = await this.spatialService.updateInfrastructureFeature(id, dto);
    if (!row) throw new NotFoundException(`Infrastructure feature not found: ${id}`);
    return row;
  }

  @Delete('infrastructure/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(204)
  async removeInfrastructureFeature(@Param('id', ParseUUIDPipe) id: string) {
    const deleted = await this.spatialService.removeInfrastructureFeature(id);
    if (!deleted) throw new NotFoundException(`Infrastructure feature not found: ${id}`);
  }

  // Admin-only layer (docs/ADMIN_PANEL_ISSUES.md Coming Soon #3 follow-up,
  // per the user's explicit "a map layer that should be visible to admin
  // only and editable by admin only") - unlike every read endpoint above,
  // GET is ADMIN-gated too: a citizen or officer session simply never sees
  // this layer, since features/map/MapComponent.tsx (their shared map) never
  // calls this route at all.
  @Get('admin-notes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getAdminMapNotes(@Query('state') state?: string, @Query('district') district?: string) {
    return this.spatialService.findAdminMapNotes({ state, district });
  }

  @Post('admin-notes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createAdminMapNote(@CurrentUser() user: User, @Body() dto: CreateAdminMapNoteDto) {
    return this.spatialService.createAdminMapNote(dto, user.id);
  }

  @Patch('admin-notes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateAdminMapNote(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAdminMapNoteDto) {
    const row = await this.spatialService.updateAdminMapNote(id, dto);
    if (!row) throw new NotFoundException(`Admin map note not found: ${id}`);
    return row;
  }

  @Delete('admin-notes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(204)
  async removeAdminMapNote(@Param('id', ParseUUIDPipe) id: string) {
    const deleted = await this.spatialService.removeAdminMapNote(id);
    if (!deleted) throw new NotFoundException(`Admin map note not found: ${id}`);
  }
}
