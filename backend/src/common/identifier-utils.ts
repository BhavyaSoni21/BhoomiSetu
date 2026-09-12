import { Repository } from 'typeorm';
import { ParcelIdentifier } from '../parcels/parcel-identifier.entity';

// Shared by DepartmentsModule's LandRecordsLookupService and
// InteroperabilityModule's IdentifierResolverService, neither of which
// import the other (that would create a module cycle - Interoperability
// depends on Departments, not the reverse) - a plain function taking an
// already-injected repository sidesteps that entirely.
export async function findIdentifierValue(
  repository: Repository<ParcelIdentifier>,
  parcelId: string,
  identifierType: string,
): Promise<string | null> {
  const identifier = await repository
    .createQueryBuilder('pi')
    .where('pi.parcel_id = :parcelId', { parcelId })
    .andWhere('pi.identifierType = :type', { type: identifierType })
    .getOne();
  return identifier?.identifierValue ?? null;
}
