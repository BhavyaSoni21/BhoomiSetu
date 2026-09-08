import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { ParcelIdentifier } from '../parcels/parcel-identifier.entity';
import { LandRecordsLookupService } from '../departments/land-records-lookup.service';
import { RegistrationService } from '../departments/registration.service';
import { PlanningService } from '../departments/planning.service';
import { TaxService } from '../departments/tax.service';
import { RestrictionService } from '../departments/restriction.service';
import { DisputeService } from '../departments/dispute.service';
import { EncumbranceService } from '../departments/encumbrance.service';
import { RegistrationRecord } from '../departments/registration-record.entity';
import { PlanningRecord } from '../departments/planning-record.entity';
import { TaxRecord } from '../departments/tax-record.entity';
import { RestrictionRecord } from '../departments/restriction-record.entity';
import { DisputeRecord } from '../departments/dispute-record.entity';
import { EncumbranceRecord } from '../departments/encumbrance-record.entity';
import { adaptLandRecordsResult, AdaptedLandRecord } from './land-record-adapters';
import { buildCanonicalEnvelope, CanonicalParcelEnvelope } from './canonical-transformer';

export interface Parcel360Response extends CanonicalParcelEnvelope {
  departments: {
    landRecords: AdaptedLandRecord | null;
    registration: RegistrationRecord | null;
    planning: PlanningRecord | null;
    tax: TaxRecord | null;
    restriction: RestrictionRecord | null;
    dispute: DisputeRecord | null;
    encumbrance: EncumbranceRecord | null;
  };
}

// Tech.md #22's "RESPONSE AGGREGATION" stage: calls every department API in
// parallel, runs the Land Records result through the State A/B adapter,
// transforms everything into the canonical envelope, and merges in the raw
// per-department payloads so Parcel 360 is genuinely useful (not just a
// pointer saying data exists). This is what GET /api/v1/parcels/:id/360
// calls - see ParcelsController.
@Injectable()
export class ResponseAggregatorService {
  constructor(
    @InjectRepository(Parcel) private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(ParcelIdentifier) private readonly identifierRepository: Repository<ParcelIdentifier>,
    private readonly landRecordsLookupService: LandRecordsLookupService,
    private readonly registrationService: RegistrationService,
    private readonly planningService: PlanningService,
    private readonly taxService: TaxService,
    private readonly restrictionService: RestrictionService,
    private readonly disputeService: DisputeService,
    private readonly encumbranceService: EncumbranceService,
  ) {}

  async buildParcel360(parcelId: string): Promise<Parcel360Response | null> {
    const parcel = await this.parcelRepository.findOneBy({ id: parcelId });
    if (!parcel) return null;

    const identifierRows = await this.identifierRepository
      .createQueryBuilder('pi')
      .where('pi.parcel_id = :parcelId', { parcelId })
      .getMany();
    const findType = (type: string) => identifierRows.find((row) => row.identifierType === type)?.identifierValue ?? null;

    const [landRecordsResult, registration, planning, tax, restriction, dispute, encumbrance] = await Promise.all([
      this.landRecordsLookupService.findByParcelId(parcelId),
      this.registrationService.findByParcelId(parcelId),
      this.planningService.findByParcelId(parcelId),
      this.taxService.findByParcelId(parcelId),
      this.restrictionService.findByParcelId(parcelId),
      this.disputeService.findByParcelId(parcelId),
      this.encumbranceService.findByParcelId(parcelId),
    ]);

    const landRecords =
      landRecordsResult && landRecordsResult !== 'PARCEL_NOT_FOUND' ? adaptLandRecordsResult(landRecordsResult) : null;

    const envelope = buildCanonicalEnvelope({
      parcel,
      surveyNumber: findType('SURVEY_NUMBER'),
      plotNumber: findType('PLOT_NUMBER'),
      localIdentifier: findType('LOCAL_PARCEL_ID'),
      locality: landRecords?.locality ?? parcel.localBodyCode,
      sourceAvailability: {
        LAND_RECORDS: landRecords !== null,
        REGISTRATION: registration !== null,
        PLANNING: planning !== null,
        TAX: tax !== null,
        RESTRICTION: restriction !== null,
        DISPUTE: dispute !== null,
        ENCUMBRANCE: encumbrance !== null,
      },
    });

    return {
      ...envelope,
      departments: { landRecords, registration, planning, tax, restriction, dispute, encumbrance },
    };
  }
}
