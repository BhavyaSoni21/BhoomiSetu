import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZoningOverlay } from './zoning-overlay.entity';
import { RestrictionZone } from './restriction-zone.entity';
import { InfrastructureFeature } from './infrastructure-feature.entity';
import { ChangeDetectionEvent } from './change-detection-event.entity';
import { CreateZoningOverlayDto, UpdateZoningOverlayDto } from './dto/zoning-overlay.dto';
import { CreateRestrictionZoneDto, UpdateRestrictionZoneDto } from './dto/restriction-zone.dto';
import { CreateInfrastructureFeatureDto, UpdateInfrastructureFeatureDto } from './dto/infrastructure-feature.dto';

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
  ) {}

  async findZoningOverlays(filter: AreaFilter) {
    const rows = await this.zoningRepository.find({ where: whereFrom(filter) });
    return toFeatureCollection(rows, (r) => ({ id: r.id, name: r.name, zoneType: r.zoneType, parcelCount: r.parcelIds?.length ?? 0 }));
  }

  async findRestrictionZones(filter: AreaFilter) {
    const rows = await this.restrictionRepository.find({ where: whereFrom(filter) });
    return toFeatureCollection(rows, (r) => ({
      id: r.id,
      name: r.name,
      restrictionType: r.restrictionType,
      affectedParcelIds: r.affectedParcelIds ?? [],
    }));
  }

  async findInfrastructure(filter: AreaFilter) {
    const rows = await this.infrastructureRepository.find({ where: whereFrom(filter) });
    return toFeatureCollection(rows, (r) => ({ id: r.id, name: r.name, featureType: r.featureType }));
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

  async createZoningOverlay(dto: CreateZoningOverlayDto): Promise<ZoningOverlay> {
    this.assertGeometryType(dto.geometry, ['Polygon']);
    return this.zoningRepository.save({ ...dto, geometry: JSON.stringify(dto.geometry) });
  }

  async updateZoningOverlay(id: string, dto: UpdateZoningOverlayDto): Promise<ZoningOverlay | null> {
    const row = await this.zoningRepository.findOneBy({ id });
    if (!row) return null;
    if (dto.geometry) this.assertGeometryType(dto.geometry, ['Polygon']);
    Object.assign(row, { ...dto, geometry: dto.geometry ? JSON.stringify(dto.geometry) : row.geometry });
    return this.zoningRepository.save(row);
  }

  async removeZoningOverlay(id: string): Promise<boolean> {
    const result = await this.zoningRepository.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  async createRestrictionZone(dto: CreateRestrictionZoneDto): Promise<RestrictionZone> {
    this.assertGeometryType(dto.geometry, ['Polygon']);
    return this.restrictionRepository.save({ ...dto, geometry: JSON.stringify(dto.geometry) });
  }

  async updateRestrictionZone(id: string, dto: UpdateRestrictionZoneDto): Promise<RestrictionZone | null> {
    const row = await this.restrictionRepository.findOneBy({ id });
    if (!row) return null;
    if (dto.geometry) this.assertGeometryType(dto.geometry, ['Polygon']);
    Object.assign(row, { ...dto, geometry: dto.geometry ? JSON.stringify(dto.geometry) : row.geometry });
    return this.restrictionRepository.save(row);
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
}
