import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { ParcelIdentifier } from '../parcels/parcel-identifier.entity';
import { LandRecordsLookupService } from '../departments/land-records-lookup.service';
import { adaptLandRecordsResult } from '../interoperability/land-record-adapters';
import { StateALandRecord } from '../land-records/state-a-land-record.entity';
import { StateBLandRecord } from '../land-records/state-b-land-record.entity';
import { extractText } from './ocr';
import { textContainsApproxNumber, textContainsIdentifier, textContainsName } from './field-matcher';

export type FieldCheckStatus = 'MATCHED' | 'MISMATCH' | 'NOT_AVAILABLE';

export interface FieldCheck {
  field: string;
  expectedValue: string;
  status: FieldCheckStatus;
}

export type VerificationVerdict = 'VERIFIED' | 'PARTIAL_MATCH' | 'MISMATCH' | 'INSUFFICIENT_DATA';

export interface DocumentVerificationResult {
  parcelId: string;
  canonicalParcelId: string | null;
  extractedText: string;
  ocrConfidence: number;
  fieldChecks: FieldCheck[];
  overallVerdict: VerificationVerdict;
}

// Citizen-facing document verification (uploaded scan/photo of a land record
// document, e.g. an RoR copy or sale deed) - OCRs it locally (tesseract.js,
// no external API key) and cross-checks the extracted text against this
// parcel's ACTUAL records, reusing the same Land Records lookup + state
// adapter (Phase 5's interoperability layer) that Parcel 360 uses, so a
// match here means "matches the real interoperability-resolved record", not
// a separately-invented comparison.
@Injectable()
export class DocumentVerificationService {
  constructor(
    @InjectRepository(Parcel) private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(ParcelIdentifier) private readonly identifierRepository: Repository<ParcelIdentifier>,
    private readonly landRecordsLookupService: LandRecordsLookupService,
  ) {}

  async verify(parcelId: string, imageBuffer: Buffer): Promise<DocumentVerificationResult> {
    const parcel = await this.parcelRepository.findOneBy({ id: parcelId });
    if (!parcel) throw new NotFoundException(`Parcel not found: ${parcelId}`);

    const { text, confidence } = await extractText(imageBuffer);

    // Blank/unreadable image (wrong file, upside down, too low-res) - report
    // this honestly rather than letting every field check fall through to a
    // misleading blanket MISMATCH.
    if (text.trim().length === 0) {
      return { parcelId, canonicalParcelId: parcel.canonicalParcelId, extractedText: text, ocrConfidence: confidence, fieldChecks: [], overallVerdict: 'INSUFFICIENT_DATA' };
    }

    const fieldChecks: FieldCheck[] = [];

    // Every identifier actually on file for this parcel, checked
    // independently - real documents vary in which identifier they print
    // (a sale deed might show the survey number but not the ULPIN).
    const identifierRows = await this.identifierRepository
      .createQueryBuilder('pi')
      .where('pi.parcel_id = :parcelId', { parcelId })
      .getMany();
    for (const row of identifierRows) {
      fieldChecks.push({
        field: `IDENTIFIER (${row.identifierType})`,
        expectedValue: row.identifierValue,
        status: textContainsIdentifier(text, row.identifierValue) ? 'MATCHED' : 'MISMATCH',
      });
    }

    // Owner name + area, resolved via the same identifier-based Land Records
    // lookup Parcel 360 uses (TN/KA parcels have no state schema in this mock
    // - see land-records-lookup.service.ts - so they fall back to just the
    // parcel's own area, with owner name reported as unavailable rather than
    // silently skipped).
    const landRecordsResult = await this.landRecordsLookupService.findByParcelId(parcelId);
    if (landRecordsResult && landRecordsResult !== 'PARCEL_NOT_FOUND') {
      const adapted = adaptLandRecordsResult(landRecordsResult);
      fieldChecks.push({
        field: 'OWNER_NAME',
        expectedValue: adapted.ownerName,
        status: textContainsName(text, adapted.ownerName) ? 'MATCHED' : 'MISMATCH',
      });

      // A real document states area in whatever unit that state's schema
      // natively uses (hectares for State A, sqft for State B), not
      // necessarily the sqm the adapter converts to for Parcel 360 - check
      // both so a document printing the native unit isn't falsely flagged.
      const nativeAreaValue =
        landRecordsResult.source === 'STATE_A'
          ? Number((landRecordsResult.data as StateALandRecord).areaHectares)
          : Number((landRecordsResult.data as StateBLandRecord).landExtentSqft);
      const nativeUnit = landRecordsResult.source === 'STATE_A' ? 'ha' : 'sqft';
      const areaMatched = textContainsApproxNumber(text, adapted.areaSqM) || textContainsApproxNumber(text, nativeAreaValue);
      fieldChecks.push({
        field: 'AREA',
        expectedValue: `${adapted.areaSqM} sqm (or ${nativeAreaValue} ${nativeUnit})`,
        status: areaMatched ? 'MATCHED' : 'MISMATCH',
      });
    } else {
      fieldChecks.push({ field: 'OWNER_NAME', expectedValue: '', status: 'NOT_AVAILABLE' });
      const areaSqM = Number(parcel.areaSqM);
      fieldChecks.push({
        field: 'AREA',
        expectedValue: `${areaSqM} sqm`,
        status: textContainsApproxNumber(text, areaSqM) ? 'MATCHED' : 'MISMATCH',
      });
    }

    const checkable = fieldChecks.filter((f) => f.status !== 'NOT_AVAILABLE');
    const matchedCount = checkable.filter((f) => f.status === 'MATCHED').length;
    const overallVerdict: VerificationVerdict =
      checkable.length === 0
        ? 'INSUFFICIENT_DATA'
        : matchedCount === checkable.length
          ? 'VERIFIED'
          : matchedCount === 0
            ? 'MISMATCH'
            : 'PARTIAL_MATCH';

    return {
      parcelId,
      canonicalParcelId: parcel.canonicalParcelId,
      extractedText: text,
      ocrConfidence: confidence,
      fieldChecks,
      overallVerdict,
    };
  }
}
