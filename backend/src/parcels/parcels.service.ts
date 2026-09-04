import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Parcel } from './parcel.entity';
import { ParcelIdentifier } from './parcel-identifier.entity';
import { ParcelNeighbour } from './parcel-neighbour.entity';
import { outerRing, parseGeometry, polygonDistanceMeters, ringCentroid } from '../common/geo-utils';

const DEFAULT_NEIGHBOUR_DISTANCE_M = 200;
const TOUCH_EPSILON_M = 3;

function toParcelFeature(parcel: Parcel) {
  return {
    type: 'Feature',
    properties: {
      id: parcel.id,
      canonicalParcelId: parcel.canonicalParcelId,
      stateCode: parcel.stateCode,
      districtCode: parcel.districtCode,
      areaSqM: parcel.areaSqM,
    },
    geometry: parseGeometry(parcel.geometry),
  };
}

@Injectable()
export class ParcelsService {
  constructor(
    @InjectRepository(Parcel)
    private parcelRepository: Repository<Parcel>,
    @InjectRepository(ParcelIdentifier)
    private parcelIdentifierRepository: Repository<ParcelIdentifier>,
    @InjectRepository(ParcelNeighbour)
    private parcelNeighbourRepository: Repository<ParcelNeighbour>,
  ) {}

  // Search parcels by various identifiers
  async searchParcels(filters: {
    ulpin?: string;
    surveyNumber?: string;
    plotNumber?: string;
    localIdentifier?: string;
    state?: string;
    district?: string;
    limit?: number;
    offset?: number;
  }) {
    // identifiers are eager-loaded via a plain join (not filtered) so the
    // response always includes a parcel's full identifier set; filters below
    // use EXISTS subqueries so combining e.g. survey_number + plot_number
    // doesn't require both to match the same joined identifier row.
    const query = this.parcelRepository.createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.identifiers', 'identifier');

    const matchesIdentifier = (type: string, value: string, key: string) => {
      query.andWhere(
        `EXISTS (SELECT 1 FROM parcel_identifiers pi WHERE pi.parcel_id = parcel.id AND pi.identifierType = :${key}Type AND pi.identifierValue = :${key}Value)`,
        { [`${key}Type`]: type, [`${key}Value`]: value },
      );
    };

    // Apply ULPIN filter (parcels also carry ulpin directly, so check both)
    if (filters.ulpin) {
      query.andWhere(
        `(parcel.ulpin = :ulpin OR EXISTS (SELECT 1 FROM parcel_identifiers pi WHERE pi.parcel_id = parcel.id AND pi.identifierType = :ulpinType AND pi.identifierValue = :ulpin))`,
        { ulpin: filters.ulpin, ulpinType: 'ULPIN' },
      );
    }

    // Apply survey number filter
    if (filters.surveyNumber) {
      matchesIdentifier('SURVEY_NUMBER', filters.surveyNumber, 'survey');
    }

    // Apply plot number filter
    if (filters.plotNumber) {
      matchesIdentifier('PLOT_NUMBER', filters.plotNumber, 'plot');
    }

    // Apply local identifier filter
    if (filters.localIdentifier) {
      matchesIdentifier('LOCAL_PARCEL_ID', filters.localIdentifier, 'local');
    }

    // Apply state filter
    if (filters.state) {
      query.andWhere('parcel.stateCode = :state', { state: filters.state });
    }

    // Apply district filter
    if (filters.district) {
      query.andWhere('parcel.districtCode = :district', { district: filters.district });
    }

    // Apply limit and offset
    if (filters.limit) {
      query.take(filters.limit);
    }
    if (filters.offset) {
      query.skip(filters.offset);
    }

    const [parcels, total] = await query.getManyAndCount();
    return { parcels, total };
  }

  // Get parcel by ID
  async findOne(id: string): Promise<Parcel | null> {
    return this.parcelRepository.findOneBy({ id });
  }

  // Get parcel geometry as a GeoJSON Feature
  async getGeometry(id: string): Promise<any | null> {
    const parcel = await this.parcelRepository.findOneBy({ id });
    if (!parcel) {
      return null;
    }
    return {
      type: 'Feature',
      properties: {
        id: parcel.id,
        canonicalParcelId: parcel.canonicalParcelId,
      },
      geometry: JSON.parse(parcel.geometry),
    };
  }

  // Adjacent (touching) and nearby parcels for contextual visibility, plus
  // the selected parcel itself - all as GeoJSON Features so the frontend can
  // render them directly. Prefers explicit ParcelNeighbour rows (generated
  // at seed time from known grid position - reliable, matches the actual
  // shared-boundary topology); falls back to live geometry distance for
  // parcels with no precomputed relationships (e.g. ad-hoc/non-seeded data).
  async getNeighbours(id: string, distanceMeters?: number) {
    const selected = await this.parcelRepository.findOneBy({ id });
    if (!selected) return null;

    const selectedRing = outerRing(parseGeometry(selected.geometry));
    const refLat = selectedRing ? ringCentroid(selectedRing)[1] : 0;

    const adjacentParcels: any[] = [];
    const nearbyParcels: any[] = [];

    const relationshipRows = await this.parcelNeighbourRepository.find({ where: { parcelId: selected.id } });

    if (relationshipRows.length > 0) {
      const neighbourParcels = await this.parcelRepository.find({
        where: { id: In(relationshipRows.map((r) => r.neighbourParcelId)) },
      });
      const parcelById = new Map(neighbourParcels.map((p) => [p.id, p]));

      for (const row of relationshipRows) {
        const parcel = parcelById.get(row.neighbourParcelId);
        if (!parcel) continue;
        const ring = outerRing(parseGeometry(parcel.geometry));
        const distance = selectedRing && ring ? polygonDistanceMeters(selectedRing, ring, refLat) : null;
        const entry = {
          parcelId: parcel.id,
          canonicalParcelId: parcel.canonicalParcelId,
          relationship: row.relationshipType as 'TOUCHING' | 'NEARBY',
          distanceMeters: distance !== null ? Math.round(distance * 10) / 10 : null,
          feature: toParcelFeature(parcel),
        };
        (row.relationshipType === 'TOUCHING' ? adjacentParcels : nearbyParcels).push(entry);
      }
    } else {
      const maxDistance =
        Number.isFinite(distanceMeters) && (distanceMeters as number) > 0
          ? (distanceMeters as number)
          : DEFAULT_NEIGHBOUR_DISTANCE_M;

      const candidates = selectedRing
        ? await this.parcelRepository.find({
            where: { stateCode: selected.stateCode, districtCode: selected.districtCode },
          })
        : [];

      for (const candidate of candidates) {
        if (candidate.id === selected.id) continue;
        const ring = outerRing(parseGeometry(candidate.geometry));
        if (!ring || !selectedRing) continue;

        const distance = polygonDistanceMeters(selectedRing, ring, refLat);
        const entry = {
          parcelId: candidate.id,
          canonicalParcelId: candidate.canonicalParcelId,
          relationship: distance <= TOUCH_EPSILON_M ? ('TOUCHING' as const) : ('NEARBY' as const),
          distanceMeters: Math.round(distance * 10) / 10,
          feature: toParcelFeature(candidate),
        };

        if (distance <= TOUCH_EPSILON_M) {
          adjacentParcels.push(entry);
        } else if (distance <= maxDistance) {
          nearbyParcels.push(entry);
        }
      }
    }

    adjacentParcels.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
    nearbyParcels.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));

    return {
      selectedParcel: {
        parcelId: selected.id,
        canonicalParcelId: selected.canonicalParcelId,
        stateCode: selected.stateCode,
        districtCode: selected.districtCode,
        clusterId: selected.clusterId,
        feature: toParcelFeature(selected),
      },
      adjacentParcels,
      nearbyParcels,
    };
  }

  // Full spatial context for a selected parcel: itself, its adjacent/nearby
  // neighbours (see getNeighbours), and every other parcel sharing its
  // clusterId - the whole connected cadastral network it's part of, so the
  // frontend never has to show a parcel in isolation.
  async getContext(id: string, distanceMeters?: number) {
    const neighbours = await this.getNeighbours(id, distanceMeters);
    if (!neighbours) return null;

    const clusterId = neighbours.selectedParcel.clusterId;
    const clusterRows = clusterId ? await this.parcelRepository.find({ where: { clusterId } }) : [];
    // No cluster on this parcel (e.g. non-seeded data): fall back to a
    // cluster of one, built from data already on hand rather than refetching.
    const clusterParcels = (
      clusterRows.length > 0
        ? clusterRows.map((p) => ({ parcelId: p.id, canonicalParcelId: p.canonicalParcelId, feature: toParcelFeature(p) }))
        : [
            {
              parcelId: neighbours.selectedParcel.parcelId,
              canonicalParcelId: neighbours.selectedParcel.canonicalParcelId,
              feature: neighbours.selectedParcel.feature,
            },
          ]
    );

    return {
      selectedParcel: neighbours.selectedParcel,
      cluster: { clusterId },
      clusterParcels,
      adjacentParcels: neighbours.adjacentParcels,
      nearbyParcels: neighbours.nearbyParcels,
    };
  }

  // Create a new parcel (for mock data generation)
  async createParcel(parcelData: Partial<Parcel>): Promise<Parcel> {
    const parcel = this.parcelRepository.create(parcelData);
    return this.parcelRepository.save(parcel);
  }

  // Add identifier to a parcel
  async addIdentifier(parcelId: string, identifierData: Partial<ParcelIdentifier>): Promise<ParcelIdentifier> {
    const parcel = await this.parcelRepository.findOneBy({ id: parcelId });
    if (!parcel) {
      throw new Error(`Parcel not found with id: ${parcelId}`);
    }

    const identifier = this.parcelIdentifierRepository.create({
      ...identifierData,
      parcel: parcel,
    });
    return this.parcelIdentifierRepository.save(identifier);
  }
}