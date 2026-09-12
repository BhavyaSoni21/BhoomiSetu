import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { ParcelIdentifier } from '../parcels/parcel-identifier.entity';
import { findIdentifierValue } from '../common/identifier-utils';

export interface ResolveParcelIdQuery {
  canonicalParcelId?: string;
  ulpin?: string;
  surveyNumber?: string;
  plotNumber?: string;
  localIdentifier?: string;
}

// Tech.md #22's "IDENTIFIER RESOLUTION" pipeline stage, formalized as its own
// service (Plan.md Phase 5). Two directions, both genuinely used elsewhere
// in the aggregation pipeline:
//  - backward: an arbitrary identifier (of unknown provenance - could come
//    from a citizen's search box or a department's own record) -> the
//    canonical parcel UUID everything else in this API keys on.
//  - forward: a canonical parcel -> the identifier value a specific external
//    department/state schema would recognise it by (used by the Land
//    Records adapter to go find the matching state_a/state_b row).
@Injectable()
export class IdentifierResolverService {
  constructor(
    @InjectRepository(Parcel) private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(ParcelIdentifier) private readonly identifierRepository: Repository<ParcelIdentifier>,
  ) {}

  async resolveParcelId(query: ResolveParcelIdQuery): Promise<string | null> {
    if (query.canonicalParcelId) {
      const parcel = await this.parcelRepository.findOneBy({ canonicalParcelId: query.canonicalParcelId });
      if (parcel) return parcel.id;
    }
    if (query.ulpin) {
      const parcel = await this.parcelRepository.findOneBy({ ulpin: query.ulpin });
      if (parcel) return parcel.id;
    }

    const candidates: Array<[string, string | undefined]> = [
      ['SURVEY_NUMBER', query.surveyNumber],
      ['PLOT_NUMBER', query.plotNumber],
      ['LOCAL_PARCEL_ID', query.localIdentifier],
    ];
    for (const [identifierType, value] of candidates) {
      if (!value) continue;
      const identifier = await this.identifierRepository.findOne({
        where: { identifierType, identifierValue: value },
        relations: ['parcel'],
      });
      if (identifier) return identifier.parcel.id;
    }

    return null;
  }

  async resolveDepartmentIdentifier(parcelId: string, identifierType: string): Promise<string | null> {
    return findIdentifierValue(this.identifierRepository, parcelId, identifierType);
  }
}
