import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZoningOverlay } from './zoning-overlay.entity';
import { RestrictionZone } from './restriction-zone.entity';
import { InfrastructureFeature } from './infrastructure-feature.entity';
import { ChangeDetectionEvent } from './change-detection-event.entity';
import { AdminMapNote } from './admin-map-note.entity';
import { CreateZoningOverlayDto, UpdateZoningOverlayDto } from './dto/zoning-overlay.dto';
import { CreateRestrictionZoneDto, UpdateRestrictionZoneDto } from './dto/restriction-zone.dto';
import { CreateInfrastructureFeatureDto, UpdateInfrastructureFeatureDto } from './dto/infrastructure-feature.dto';
import { CreateAdminMapNoteDto, UpdateAdminMapNoteDto } from './dto/admin-map-note.dto';
import { Parcel } from '../parcels/parcel.entity';
import { GovernanceAlert } from '../governance/governance-alert.entity';
import { Ring, outerRing, parseGeometry, pointInRing, ringCentroid, ringsOverlap } from '../common/geo-utils';

interface AreaFilter {
  state?: string;
  district?: string;
}

function toFeatureCollection(rows: Array<{ geometry: string }>, propsOf: (row: any) => Record<string, unknown>) {
  return {
    type: 'FeatureCollection',
    features: rows.map((row) => ({
      type: 'Feature',
      properties: propsOf(row),
      geometry: JSON.parse(row.geometry),
    })),
  };
}

function whereFrom(filter: AreaFilter) {
  const where: Record<string, string> = {};
  if (filter.state) where.stateCode = filter.state;
  if (filter.district) where.district = filter.district;
  return where;
}

// Read layers for the spatial demo data seed.ts populates (zoning,
// restrictions, infrastructure, change detection), plus write endpoints for
// the first three (docs/FEATURE_AUDIT.md §8 item 13) - change detection
// events stay read-only here since they're created exclusively through the
// dedicated /change-detection/analyze pipeline, not raw manual entry.
@Injectable()
export class SpatialService {
  constructor(
    @InjectRepository(ZoningOverlay) private readonly zoningRepository: Repository<ZoningOverlay>,
    @InjectRepository(RestrictionZone) private readonly restrictionRepository: Repository<RestrictionZone>,
    @InjectRepository(InfrastructureFeature) private readonly infrastructureRepository: Repository<InfrastructureFeature>,
    @InjectRepository(ChangeDetectionEvent) private readonly changeDetectionRepository: Repository<ChangeDetectionEvent>,
    @InjectRepository(AdminMapNote) private readonly adminMapNoteRepository: Repository<AdminMapNote>,
    @InjectRepository(Parcel) private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(GovernanceAlert) private readonly alertRepository: Repository<GovernanceAlert>,
  ) {}

  async findZoningOverlays(filter: AreaFilter) {
    const rows = await this.zoningRepository.find({ where: whereFrom(filter) });
    return toFeatureCollection(rows, (r) => ({
      id: r.id,
      name: r.name,
      zoneType: r.zoneType,
      stateCode: r.stateCode,
      district: r.district,
      parcelIds: r.parcelIds ?? [],
      parcelCount: r.parcelIds?.length ?? 0,
    }));
  }

  async findRestrictionZones(filter: AreaFilter) {
    const rows = await this.restrictionRepository.find({ where: whereFrom(filter) });
    return toFeatureCollection(rows, (r) => ({
      id: r.id,
      name: r.name,
      restrictionType: r.restrictionType,
      stateCode: r.stateCode,
      district: r.district,
      affectedParcelIds: r.affectedParcelIds ?? [],
    }));
  }

  async findInfrastructure(filter: AreaFilter) {
    const rows = await this.infrastructureRepository.find({ where: whereFrom(filter) });
    return toFeatureCollection(rows, (r) => ({
      id: r.id,
      name: r.name,
      featureType: r.featureType,
      stateCode: r.stateCode,
      district: r.district,
    }));
  }

  async findChangeDetectionEvents(filter: AreaFilter) {
    const rows = await this.changeDetectionRepository.find({ where: whereFrom(filter) });
    return toFeatureCollection(rows, (r) => ({
      id: r.id,
      description: r.description,
      affectedParcelIds: r.affectedParcelIds ?? [],
      detectedAt: r.detectedAt,
    }));
  }

  private assertGeometryType(geometry: Record<string, unknown>, allowed: string[]): void {
    if (!allowed.includes(geometry.type as string)) {
      throw new BadRequestException(`geometry.type must be one of: ${allowed.join(', ')}`);
    }
  }

  // "Zone" here means the two polygon layers only (zoning overlays,
  // restriction zones) - infrastructure/admin-notes aren't checked, and a
  // zoning overlay is only ever compared against other zoning overlays, a
  // restriction zone only against other restriction zones (a flood zone and
  // a residential zoning classification can legitimately cover the same
  // land). excludeId lets an update skip comparing a zone against itself.
  private rejectIfOverlapping(ring: Ring, existingRows: { id: string; name: string; geometry: string }[], excludeId?: string): void {
    for (const row of existingRows) {
      if (row.id === excludeId) continue;
      const otherRing = outerRing(parseGeometry(row.geometry));
      if (otherRing && ringsOverlap(ring, otherRing)) {
        throw new BadRequestException(`This zone's geometry overlaps an existing zone: "${row.name}". Adjust the geometry or edit the existing zone instead.`);
      }
    }
  }

  // Authoritative "which parcels does this zone actually affect" - same
  // centroid-in-ring technique already established by
  // ChangeDetectionService.findParcelsInRegion and seed.ts, used here instead
  // of trusting whatever affectedParcelIds/parcelIds the client sent.
  private async computeAffectedParcelIds(ring: Ring): Promise<string[]> {
    const parcels = await this.parcelRepository.find();
    return parcels
      .filter((parcel) => {
        const parcelRing = outerRing(parseGeometry(parcel.geometry));
        return parcelRing !== null && pointInRing(ringCentroid(parcelRing), ring);
      })
      .map((p) => p.id);
  }

  async createZoningOverlay(dto: CreateZoningOverlayDto): Promise<ZoningOverlay> {
    this.assertGeometryType(dto.geometry, ['Polygon']);
    const ring = (dto.geometry as any).coordinates[0] as Ring;
    this.rejectIfOverlapping(ring, await this.zoningRepository.find());
    const parcelIds = await this.computeAffectedParcelIds(ring);
    return this.zoningRepository.save({ ...dto, geometry: JSON.stringify(dto.geometry), parcelIds });
  }

  async updateZoningOverlay(id: string, dto: UpdateZoningOverlayDto): Promise<ZoningOverlay | null> {
    const row = await this.zoningRepository.findOneBy({ id });
    if (!row) return null;
    if (dto.geometry) this.assertGeometryType(dto.geometry, ['Polygon']);
    const ring = dto.geometry ? ((dto.geometry as any).coordinates[0] as Ring) : null;
    let parcelIds = row.parcelIds;
    if (ring) {
      this.rejectIfOverlapping(ring, await this.zoningRepository.find(), id);
      parcelIds = await this.computeAffectedParcelIds(ring);
    }
    Object.assign(row, { ...dto, geometry: dto.geometry ? JSON.stringify(dto.geometry) : row.geometry, parcelIds });
    return this.zoningRepository.save(row);
  }

  async removeZoningOverlay(id: string): Promise<boolean> {
    const result = await this.zoningRepository.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  // One GovernanceAlert per newly-affected parcel (RESTRICTION_ZONE_OVERLAP /
  // RESTRICTION_MONITOR), mirroring the wording seed.ts already established
  // for its one seed-time row. "Newly" matters on update - a parcel already
  // in previousParcelIds already has (or had) its alert, so re-flagging it
  // would just spam duplicate OPEN alerts.
  private async createOverlapAlerts(parcelIds: string[], previousParcelIds: string[] = []): Promise<void> {
    const newlyAffected = parcelIds.filter((id) => !previousParcelIds.includes(id));
    if (newlyAffected.length === 0) return;
    await this.alertRepository.save(
      newlyAffected.map((parcelId) => ({
        parcelId,
        alertType: 'RESTRICTION_ZONE_OVERLAP',
        severity: 'MEDIUM',
        source: 'RESTRICTION_MONITOR',
        explanation:
          'This parcel intersects an admin-defined restriction zone. Any land-use change or construction request here should be reviewed against the zone\'s regulations before approval.',
      })),
    );
  }

  async createRestrictionZone(dto: CreateRestrictionZoneDto): Promise<RestrictionZone> {
    this.assertGeometryType(dto.geometry, ['Polygon']);
    const ring = (dto.geometry as any).coordinates[0] as Ring;
    this.rejectIfOverlapping(ring, await this.restrictionRepository.find());
    const affectedParcelIds = await this.computeAffectedParcelIds(ring);
    const saved = await this.restrictionRepository.save({ ...dto, geometry: JSON.stringify(dto.geometry), affectedParcelIds });
    await this.createOverlapAlerts(affectedParcelIds);
    return saved;
  }

  async updateRestrictionZone(id: string, dto: UpdateRestrictionZoneDto): Promise<RestrictionZone | null> {
    const row = await this.restrictionRepository.findOneBy({ id });
    if (!row) return null;
    if (dto.geometry) this.assertGeometryType(dto.geometry, ['Polygon']);
    const ring = dto.geometry ? ((dto.geometry as any).coordinates[0] as Ring) : null;
    const previousParcelIds = row.affectedParcelIds ?? [];
    let affectedParcelIds = previousParcelIds;
    if (ring) {
      this.rejectIfOverlapping(ring, await this.restrictionRepository.find(), id);
      affectedParcelIds = await this.computeAffectedParcelIds(ring);
    }
    Object.assign(row, { ...dto, geometry: dto.geometry ? JSON.stringify(dto.geometry) : row.geometry, affectedParcelIds });
    const saved = await this.restrictionRepository.save(row);
    if (ring) await this.createOverlapAlerts(affectedParcelIds, previousParcelIds);
    return saved;
  }

  async removeRestrictionZone(id: string): Promise<boolean> {
    const result = await this.restrictionRepository.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  async createInfrastructureFeature(dto: CreateInfrastructureFeatureDto): Promise<InfrastructureFeature> {
    this.assertGeometryType(dto.geometry, ['Point', 'LineString']);
    return this.infrastructureRepository.save({ ...dto, geometry: JSON.stringify(dto.geometry) });
  }

  async updateInfrastructureFeature(id: string, dto: UpdateInfrastructureFeatureDto): Promise<InfrastructureFeature | null> {
    const row = await this.infrastructureRepository.findOneBy({ id });
    if (!row) return null;
    if (dto.geometry) this.assertGeometryType(dto.geometry, ['Point', 'LineString']);
    Object.assign(row, { ...dto, geometry: dto.geometry ? JSON.stringify(dto.geometry) : row.geometry });
    return this.infrastructureRepository.save(row);
  }

  async removeInfrastructureFeature(id: string): Promise<boolean> {
    const result = await this.infrastructureRepository.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  // Admin-only layer (docs/ADMIN_PANEL_ISSUES.md Coming Soon #3 follow-up) -
  // every caller into these four methods is already ADMIN-gated at the
  // controller (SpatialController's admin-notes routes, unlike the public
  // reads above), so no extra role check is needed here.
  async findAdminMapNotes(filter: AreaFilter) {
    const rows = await this.adminMapNoteRepository.find({ where: whereFrom(filter) });
    return toFeatureCollection(rows, (r) => ({
      id: r.id,
      name: r.name,
      notes: r.notes,
      stateCode: r.stateCode,
      district: r.district,
      createdByUserId: r.createdByUserId,
    }));
  }

  async createAdminMapNote(dto: CreateAdminMapNoteDto, createdByUserId: string): Promise<AdminMapNote> {
    this.assertGeometryType(dto.geometry, ['Point', 'LineString', 'Polygon']);
    return this.adminMapNoteRepository.save({ ...dto, geometry: JSON.stringify(dto.geometry), createdByUserId });
  }

  async updateAdminMapNote(id: string, dto: UpdateAdminMapNoteDto): Promise<AdminMapNote | null> {
    const row = await this.adminMapNoteRepository.findOneBy({ id });
    if (!row) return null;
    if (dto.geometry) this.assertGeometryType(dto.geometry, ['Point', 'LineString', 'Polygon']);
    Object.assign(row, { ...dto, geometry: dto.geometry ? JSON.stringify(dto.geometry) : row.geometry });
    return this.adminMapNoteRepository.save(row);
  }

  async removeAdminMapNote(id: string): Promise<boolean> {
    const result = await this.adminMapNoteRepository.delete({ id });
    return (result.affected ?? 0) > 0;
  }
}
