import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parcel } from './parcel.entity';
import { ParcelIdentifier } from './parcel-identifier.entity';

@Injectable()
export class ParcelsService {
  constructor(
    @InjectRepository(Parcel)
    private parcelRepository: Repository<Parcel>,
    @InjectRepository(ParcelIdentifier)
    private parcelIdentifierRepository: Repository<ParcelIdentifier>,
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
    const query = this.parcelRepository.createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.identifiers', 'identifier');

    // Apply ULPIN filter
    if (filters.ulpin) {
      query.andWhere(
        '(parcel.ulpin = :ulpin OR identifier.identifierValue = :ulpin AND identifier.identifierType = :ulpinType)',
        { ulpin: filters.ulpin, ulpinType: 'ULPIN' },
      );
    }

    // Apply survey number filter
    if (filters.surveyNumber) {
      query.andWhere(
        '(identifier.identifierValue = :surveyNumber AND identifier.identifierType = :surveyType)',
        { surveyNumber: filters.surveyNumber, surveyType: 'SURVEY_NUMBER' },
      );
    }

    // Apply plot number filter
    if (filters.plotNumber) {
      query.andWhere(
        '(identifier.identifierValue = :plotNumber AND identifier.identifierType = :plotType)',
        { plotNumber: filters.plotNumber, plotType: 'PLOT_NUMBER' },
      );
    }

    // Apply local identifier filter
    if (filters.localIdentifier) {
      query.andWhere(
        '(identifier.identifierValue = :localIdentifier AND identifier.identifierType = :localType)',
        { localIdentifier: filters.localIdentifier, localType: 'LOCAL_PARCEL_ID' },
      );
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