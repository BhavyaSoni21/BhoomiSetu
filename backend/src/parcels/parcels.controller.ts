import { Controller, Get, Post, Query, Param, ParseUUIDPipe, NotFoundException, ForbiddenException, BadRequestException, UseGuards, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ParcelsService } from './parcels.service';
import { ResponseAggregatorService } from '../interoperability/response-aggregator.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { PredictiveAnalyticsService } from '../predictive-analytics/predictive-analytics.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ALL_STAFF_ROLES, CITIZEN_ROLE } from '../auth/roles.constants';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/user.entity';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB, matching the old document-verification controller's own limit

@Controller('parcels')
export class ParcelsController {
  constructor(
    private readonly parcelsService: ParcelsService,
    private readonly responseAggregatorService: ResponseAggregatorService,
    private readonly workflowsService: WorkflowsService,
    private readonly predictiveAnalyticsService: PredictiveAnalyticsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async searchParcels(
    @Query('ulpin') ulpin?: string,
    @Query('survey_number') surveyNumber?: string,
    @Query('plot_number') plotNumber?: string,
    @Query('local_identifier') localIdentifier?: string,
    @Query('state') state?: string,
    @Query('district') district?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.parcelsService.searchParcels({
      ulpin,
      surveyNumber,
      plotNumber,
      localIdentifier,
      state,
      district,
      limit,
      offset,
    });
  }

  // Upload-first Land Claim (docs/FRONTEND_UPGRADE_SPEC.md follow-up) - OCRs
  // an uploaded land document and returns whichever real parcel(s) it
  // matches, so the citizen doesn't need to already know their ULPIN/survey
  // number. Pure read (see ParcelsService.identifyFromDocument) - tighter
  // rate limit than the app default since OCR is real CPU work per request,
  // same reasoning as the old document-verification controller.
  @Post('identify-from-document')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CITIZEN_ROLE)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('document', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  async identifyFromDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('A "document" image file is required');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }
    return this.parcelsService.identifyFromDocument(file.buffer);
  }

  // Registered before ':id' so 'mine' is never swallowed as an id param.
  // Optional citizen sign-in (docs/Plan.md Phase 12) - the parcels linked to
  // the signed-in citizen's account, for a "My Parcels" dashboard.
  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CITIZEN_ROLE)
  async getMyParcels(@CurrentUser() user: User) {
    return this.parcelsService.findMine(user.id);
  }

  @Get(':id')
  async getParcel(@Param('id', ParseUUIDPipe) id: string) {
    return this.parcelsService.findOne(id);
  }

  @Get(':id/geometry')
  async getParcelGeometry(@Param('id', ParseUUIDPipe) id: string) {
    const geometry = await this.parcelsService.getGeometry(id);
    if (!geometry) {
      throw new NotFoundException(`Parcel not found with id: ${id}`);
    }
    return geometry;
  }

  @Get(':id/neighbours')
  async getNeighbours(@Param('id', ParseUUIDPipe) id: string, @Query('distance') distance?: string) {
    const result = await this.parcelsService.getNeighbours(id, distance !== undefined ? Number(distance) : undefined);
    if (!result) {
      throw new NotFoundException(`Parcel not found with id: ${id}`);
    }
    return result;
  }

  @Get(':id/context')
  async getContext(@Param('id', ParseUUIDPipe) id: string, @Query('distance') distance?: string) {
    const result = await this.parcelsService.getContext(id, distance !== undefined ? Number(distance) : undefined);
    if (!result) {
      throw new NotFoundException(`Parcel not found with id: ${id}`);
    }
    return result;
  }

  @Get(':id/workflows')
  async getWorkflows(@Param('id', ParseUUIDPipe) id: string) {
    const parcel = await this.parcelsService.findOne(id);
    if (!parcel) {
      throw new NotFoundException(`Parcel not found with id: ${id}`);
    }
    return this.workflowsService.findByParcel(id);
  }

  // Public by default (a search result should still be inspectable before
  // signing in), but the ownership-sensitive department fields - Planning,
  // Tax, Restriction, Dispute, Encumbrance - are only included for staff or
  // the citizen actually associated with this parcel, same reasoning as
  // ownership-history below: anyone else browsing a parcel that isn't theirs
  // shouldn't see its financial/legal detail, only the general-purpose
  // Land Records/Registration facts.
  @Get(':id/360')
  @UseGuards(OptionalJwtAuthGuard)
  async getParcel360(@CurrentUser() user: User | undefined, @Param('id', ParseUUIDPipe) id: string) {
    const result = await this.responseAggregatorService.buildParcel360(id);
    if (!result) {
      throw new NotFoundException(`Parcel not found with id: ${id}`);
    }
    let canViewRestrictedDepartments = !!user && (ALL_STAFF_ROLES as readonly string[]).includes(user.role);
    if (!canViewRestrictedDepartments && user?.role === CITIZEN_ROLE) {
      canViewRestrictedDepartments = await this.parcelsService.isCitizenAssociatedWithParcel(user.id, id);
    }
    if (!canViewRestrictedDepartments) {
      result.departments.planning = null;
      result.departments.tax = null;
      result.departments.restriction = null;
      result.departments.dispute = null;
      result.departments.encumbrance = null;
    }
    return { ...result, restrictedForViewer: !canViewRestrictedDepartments };
  }

  // Citizen-restricted (docs/FEATURE_AUDIT.md §8a): staff always see it;
  // a citizen only sees it for a parcel actually in their own
  // citizen_parcels association, never for any parcel they merely view.
  @Get(':id/ownership-history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALL_STAFF_ROLES, CITIZEN_ROLE)
  async getOwnershipHistory(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    const parcel = await this.parcelsService.findOne(id);
    if (!parcel) {
      throw new NotFoundException(`Parcel not found with id: ${id}`);
    }
    if (user.role === CITIZEN_ROLE) {
      const associated = await this.parcelsService.isCitizenAssociatedWithParcel(user.id, id);
      if (!associated) {
        throw new ForbiddenException('Ownership history is only visible for parcels associated with your account');
      }
    }
    return this.parcelsService.getOwnershipHistory(id);
  }

  // Land property papers (docs/FRONTEND_UPGRADE_SPEC.md follow-up) - listing
  // is public metadata, same as Parcel 360's own public tabs; the actual
  // image is gated below (the parcel's linked citizen, or staff), same
  // pattern as ownership-history above.
  @Get(':id/documents')
  async getDocuments(@Param('id', ParseUUIDPipe) id: string) {
    const parcel = await this.parcelsService.findOne(id);
    if (!parcel) {
      throw new NotFoundException(`Parcel not found with id: ${id}`);
    }
    return this.parcelsService.getDocuments(id);
  }

  @Get(':id/documents/:docId/file')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALL_STAFF_ROLES, CITIZEN_ROLE)
  async getDocumentFile(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Res() res: Response,
  ) {
    if (user.role === CITIZEN_ROLE) {
      const associated = await this.parcelsService.isCitizenAssociatedWithParcel(user.id, id);
      if (!associated) {
        throw new ForbiddenException('This document is only visible for parcels associated with your account');
      }
    }
    const file = await this.parcelsService.getDocumentFile(id, docId);
    if (!file) {
      throw new NotFoundException(`Document not found: ${docId}`);
    }
    res.set('Content-Type', file.mimeType);
    res.send(file.buffer);
  }

  // Public, same as getParcel360/getRiskScore below - attribute-level status
  // per year, not personal data (unlike ownership-history above).
  @Get(':id/history')
  async getHistoricalStates(@Param('id', ParseUUIDPipe) id: string, @Query('year') year?: string) {
    const parcel = await this.parcelsService.findOne(id);
    if (!parcel) {
      throw new NotFoundException(`Parcel not found with id: ${id}`);
    }
    return this.parcelsService.getHistoricalStates(id, year !== undefined ? Number(year) : undefined);
  }

  @Get(':id/risk-score')
  async getRiskScore(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.predictiveAnalyticsService.getRiskScore(id);
    if (!result) {
      throw new NotFoundException(`Parcel not found with id: ${id}`);
    }
    return result;
  }

  // Staff-only (docs/FEATURE_AUDIT.md §8 item 10) - the audit trail is an
  // oversight tool, not citizen-facing like GET :id/workflows above.
  @Get(':id/audit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALL_STAFF_ROLES)
  async getAudit(@Param('id', ParseUUIDPipe) id: string) {
    const parcel = await this.parcelsService.findOne(id);
    if (!parcel) {
      throw new NotFoundException(`Parcel not found with id: ${id}`);
    }
    return this.auditService.findByParcel(id);
  }
}