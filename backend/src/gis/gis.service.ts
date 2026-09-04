import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parcel } from '../parcels/parcel.entity';

@Injectable()
export class GisService {
  constructor(
    @InjectRepository(Parcel)
    private parcelRepository: Repository<Parcel>,
  ) {}

  // Get parcels with optional filtering
  async findAll(filters: {
    bbox?: [number, number, number, number]; // [minX, minY, maxX, maxY]
    zoom?: number;
    state?: string;
    district?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = this.parcelRepository.createQueryBuilder('parcel');

    // Apply bounding box filter
    // Note: For production with PostGIS, use ST_Intersects
    // For development with SQLite, we'll use basic coordinate filtering
    // assuming we have centroid coordinates stored or we'll skip spatial filters
    if (filters.bbox) {
      const [minX, minY, maxX, maxY] = filters.bbox;
      // In a real implementation with PostGIS, we would use:
      // query.andWhere('ST_Intersects(parcel.geometry, ST_MakeEnvelope(:minX, :minY, :maxX, :maxY, 4326))', {
      //   minX, minY, maxX, maxY,
      // });

      // For development without PostGIS, we'll skip spatial filtering
      // and note that this should be implemented with PostGIS in production
      console.warn('Spatial filtering disabled in development mode. Enable PostGIS for production.');
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

  // Get parcel geometry as GeoJSON
  async getGeometry(id: string): Promise<any> {
    const parcel = await this.parcelRepository.findOneBy({ id });
    if (!parcel) {
      return null;
    }
    return {
      type: 'Feature',
      properties: {
        id: parcel.id,
        canonicalParcelId: parcel.canonicalParcelId,
        ulpin: parcel.ulpin,
        stateCode: parcel.stateCode,
        districtCode: parcel.districtCode,
        localBodyCode: parcel.localBodyCode,
        areaSqM: parcel.areaSqM,
      },
      geometry: JSON.parse(parcel.geometry), // Assuming geometry is stored as JSON string
    };
  }

  // Check spatial restrictions for a parcel
  async getRestrictions(id: string): Promise<any[]> {
    // This would typically query a restrictions table or service
    // For now, returning empty array as placeholder
    return [];
  }

  // Find parcel at specific coordinates (lat, lng)
  async findParcelAtLocation(lat: number, lng: number): Promise<Parcel | null> {
    // In a real implementation with PostGIS, we would use:
    // return this.parcelRepository
    //   .createQueryBuilder('parcel')
    //   .where('ST_Contains(parcel.geometry, ST_SetSRID(ST_Point(:lng, :lat), 4326))', { lat, lng })
    //   .getOne();

    // For development without PostGIS, we'll return null and note the limitation
    console.warn('Spatial queries disabled in development mode. Enable PostGIS for production.');
    return null;
  }
}