import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import sharp from 'sharp';
import { Parcel } from '../parcels/parcel.entity';
import { ChangeDetectionEvent } from '../spatial/change-detection-event.entity';
import { GovernanceAlert } from '../governance/governance-alert.entity';
import { Ring, outerRing, parseGeometry, pointInRing, ringCentroid } from '../common/geo-utils';
import { isPostgisAvailable } from '../common/postgis';
import { diffImages, pixelBoxToGeoBox, GeoBounds } from './image-diff';

// Fixed analysis grid: both images are resized to this regardless of their
// original resolution, so the pixel-diff loop is fast and the pixel->geo
// mapping in image-diff.ts stays simple. Coarser than a real satellite pass
// needs to be, which is fine for this mock's parcel sizes.
const ANALYSIS_SIZE = 200;

export interface ChangeAnalysisResult {
  changeDetected: boolean;
  changedPixelRatio: number;
  changeRegion: any | null; // GeoJSON Polygon - no @types/geojson in this backend, matching canonical-transformer.ts's convention
  eventId: string | null;
  affectedParcelIds: string[];
  alertsCreated: number;
}

// Tech.md #33's full pipeline (IMAGE T1/T2 -> PREPROCESSING -> CHANGE
// ANALYSIS -> CHANGE REGION -> SPATIAL INTERSECTION -> AFFECTED PARCEL ->
// GOVERNANCE ALERT), in Node/TypeScript rather than a separate Python/OpenCV
// service - see docs/Plan.md Phase 9 for why. Every step after "the caller
// uploaded two images" is real: real pixel comparison, a real geographic
// change region, a real point-in-polygon test against every seeded parcel's
// centroid (the same technique seed.ts already uses for its flood zone and
// simulated change-detection event), and real ChangeDetectionEvent /
// GovernanceAlert rows - nothing here is hand-picked.
@Injectable()
export class ChangeDetectionService {
  constructor(
    @InjectRepository(Parcel) private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(ChangeDetectionEvent) private readonly eventRepository: Repository<ChangeDetectionEvent>,
    @InjectRepository(GovernanceAlert) private readonly alertRepository: Repository<GovernanceAlert>,
  ) {}

  async analyze(before: Buffer, after: Buffer, bounds: GeoBounds, description?: string): Promise<ChangeAnalysisResult> {
    const [beforeRaw, afterRaw] = await Promise.all([
      sharp(before).resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: 'fill' }).ensureAlpha().raw().toBuffer(),
      sharp(after).resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: 'fill' }).ensureAlpha().raw().toBuffer(),
    ]);

    const diff = diffImages(beforeRaw, afterRaw, ANALYSIS_SIZE, ANALYSIS_SIZE);
    if (!diff.changed || !diff.bbox) {
      return { changeDetected: false, changedPixelRatio: diff.changedPixelRatio, changeRegion: null, eventId: null, affectedParcelIds: [], alertsCreated: 0 };
    }

    const geoBox = pixelBoxToGeoBox(diff.bbox, ANALYSIS_SIZE, ANALYSIS_SIZE, bounds);
    const changeRing: Ring = [
      [geoBox.minLng, geoBox.minLat],
      [geoBox.maxLng, geoBox.minLat],
      [geoBox.maxLng, geoBox.maxLat],
      [geoBox.minLng, geoBox.maxLat],
      [geoBox.minLng, geoBox.minLat],
    ];
    const changeRegion = { type: 'Polygon', coordinates: [changeRing] };

    // SPATIAL INTERSECTION: every parcel whose centroid falls inside the
    // detected change region (docs/FEATURE_AUDIT.md §8 item 14) - a real
    // Postgres ST_Contains/ST_Centroid query, or a JS point-in-polygon
    // fallback scan on SQLite.
    const affectedParcels = await this.findParcelsInRegion(changeRegion);
    const affectedParcelIds = affectedParcels.map((p) => p.id);

    const event = await this.eventRepository.save({
      description: description ?? `Change detected via uploaded imagery comparison (${(diff.changedPixelRatio * 100).toFixed(1)}% of analyzed area)`,
      stateCode: affectedParcels[0]?.stateCode ?? 'UNK',
      district: affectedParcels[0]?.districtCode ?? 'UNK',
      geometry: JSON.stringify(changeRegion),
      affectedParcelIds,
    });

    // GOVERNANCE ALERT: one per affected parcel, same alertType/source
    // convention seed.ts already established for the simulated event in
    // Phase 7, so both real and seeded alerts read identically to an officer.
    const severity = diff.changedPixelRatio > 0.05 ? 'HIGH' : 'MEDIUM';
    const alerts =
      affectedParcelIds.length > 0
        ? await this.alertRepository.save(
            affectedParcelIds.map((parcelId) => ({
              parcelId,
              alertType: 'UNAUTHORIZED_CHANGE_DETECTED',
              severity,
              source: 'CHANGE_DETECTION',
              status: 'OPEN',
              explanation: `Comparison of before/after imagery flagged a physical change (${(diff.changedPixelRatio * 100).toFixed(1)}% of the analyzed area) affecting this parcel that is not yet reflected in official land records. Recommend officer review.`,
            })),
          )
        : [];

    return { changeDetected: true, changedPixelRatio: diff.changedPixelRatio, changeRegion, eventId: event.id, affectedParcelIds, alertsCreated: alerts.length };
  }

  // Every parcel whose centroid falls inside a given GeoJSON Polygon region.
  // Previously extracted into common/spatial-queries.ts for a second caller
  // (HistoricalComparisonService); that feature was redesigned 2026-09-08 to
  // detect change via real dispute/restriction data instead of pixel-diffed
  // regions, so this went back to having exactly one caller - inlined here
  // rather than kept as a "shared" module for a single consumer, matching
  // this codebase's usual convention of duplicating small one-off helpers
  // instead of sharing them across module boundaries.
  private async findParcelsInRegion(region: { type: string; coordinates: number[][][] }): Promise<Parcel[]> {
    if (isPostgisAvailable(this.parcelRepository)) {
      const rows: { id: string }[] = await this.parcelRepository.query(
        `SELECT id FROM parcels
         WHERE ST_Contains(
           ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
           ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON(geometry), 4326))
         )`,
        [JSON.stringify(region)],
      );
      return rows.length > 0 ? this.parcelRepository.find({ where: { id: In(rows.map((r) => r.id)) } }) : [];
    }

    const regionRing: Ring = region.coordinates[0] as Ring;
    const allParcels = await this.parcelRepository.find();
    return allParcels.filter((parcel) => {
      const ring = outerRing(parseGeometry(parcel.geometry));
      return ring !== null && pointInRing(ringCentroid(ring), regionRing);
    });
  }
}
