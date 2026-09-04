import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZoningOverlay } from './zoning-overlay.entity';
import { RestrictionZone } from './restriction-zone.entity';
import { InfrastructureFeature } from './infrastructure-feature.entity';
import { ChangeDetectionEvent } from './change-detection-event.entity';

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

// Read-only layers for the spatial demo data seed.ts populates (zoning,
// restrictions, infrastructure, change detection). No write endpoints yet -
// that's the Planning/Restriction department APIs and the change-detection
// pipeline, both later phases. This just lets the map render what's there.
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
}
