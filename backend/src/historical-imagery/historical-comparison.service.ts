import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { readFile } from 'fs/promises';
import { ClusterHistoricalSnapshot } from './cluster-historical-snapshot.entity';
import { NarrativeService, ParcelChangeFact } from './narrative.service';
import { Parcel } from '../parcels/parcel.entity';
import { ParcelHistoricalState } from '../parcels/parcel-historical-state.entity';
import { DisputeRecord } from '../departments/dispute-record.entity';
import { RestrictionRecord } from '../departments/restriction-record.entity';
import { GovernanceAlert } from '../governance/governance-alert.entity';
import { categoryFor, CATEGORY_LABELS, CURRENT_YEAR, ParcelCategory } from '../common/parcel-generation/parcel-category';

// Bounds the LLM call's per-request latency regardless of how many parcels
// a comparison actually affects - see the usage site below for the live
// timing that motivated this.
const MAX_LLM_NARRATIVE_PARCELS = 20;

export interface AffectedParcelResult {
  parcelId: string;
  canonicalParcelId: string;
  fromCategory: ParcelCategory;
  toCategory: ParcelCategory;
  narrative: string;
  alertId: string | null;
}

export interface HistoricalComparisonResult {
  clusterId: string;
  fromYear: number;
  toYear: number;
  changeDetected: boolean;
  affectedParcels: AffectedParcelResult[];
}

export interface CategorizedParcel {
  id: string;
  canonicalParcelId: string | null;
  ulpin: string | null;
  stateCode: string;
  districtCode: string;
  localBodyCode: string;
  areaSqM: number;
  geometry: string;
  category: ParcelCategory;
}

// Historical parcel-imagery comparison (docs/FRONTEND_UPGRADE_SPEC.md §8) -
// redesigned 2026-09-08 per the user's follow-up ("remove the pixel
// difference feature... the data looks like fetched from the dataset...
// I want the output as there is this dispute in this parcel... more colour
// variation depicting different causes"). "What's different between two
// years" is now a plain, real data comparison - each parcel's ParcelCategory
// (parcel-category.ts, the exact same function the seed-time renderer uses
// to color the snapshot) computed for both years; a parcel is "affected" if
// its category differs. No pixel math, no bounding boxes, no spatial
// intersection - the category IS the localization, since it's keyed
// directly by parcel id. The LLM's job is narrower but more central than
// before: given the real facts behind each affected parcel's category
// change (a real DisputeRecord or a real ParcelHistoricalState restriction
// flip - never invented), write one grounded, readable sentence per parcel.
// A failed/unconfigured LLM call falls back to the same real facts, plainly
// phrased - the output is never blocked by, or dependent on, the AI call.
@Injectable()
export class HistoricalComparisonService {
  constructor(
    @InjectRepository(ClusterHistoricalSnapshot) private readonly snapshotRepository: Repository<ClusterHistoricalSnapshot>,
    @InjectRepository(Parcel) private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(ParcelHistoricalState) private readonly historicalStateRepository: Repository<ParcelHistoricalState>,
    @InjectRepository(DisputeRecord) private readonly disputeRepository: Repository<DisputeRecord>,
    @InjectRepository(RestrictionRecord) private readonly restrictionRepository: Repository<RestrictionRecord>,
    @InjectRepository(GovernanceAlert) private readonly alertRepository: Repository<GovernanceAlert>,
    private readonly narrativeService: NarrativeService,
  ) {}

  async listClusters(): Promise<{ clusterId: string; years: number[] }[]> {
    const rows = await this.snapshotRepository.find({ order: { clusterId: 'ASC', year: 'ASC' } });
    const byCluster = new Map<string, number[]>();
    for (const row of rows) {
      const years = byCluster.get(row.clusterId) ?? [];
      years.push(row.year);
      byCluster.set(row.clusterId, years);
    }
    return Array.from(byCluster.entries()).map(([clusterId, years]) => ({ clusterId, years }));
  }

  async getSnapshotImage(clusterId: string, year: number): Promise<Buffer> {
    const snapshot = await this.snapshotRepository.findOneBy({ clusterId, year });
    if (!snapshot) {
      throw new NotFoundException(`No snapshot for cluster ${clusterId}, year ${year}`);
    }
    return readFile(snapshot.imagePath);
  }

  // Real parcel geometry + a real ParcelCategory per parcel for one year -
  // lets the frontend render an actual year's boundaries on the live
  // MapLibre map (features/map/MapComponent.tsx), colored the same way the
  // seed-time snapshot PNG is, instead of only ever showing that flat
  // raster image. Added 2026-09-08 per the user's follow-up ("I want these
  // boundaries to be presented on the real map ... a dropdown ... any year
  // data can be visible on that map").
  async getParcelsForYear(clusterId: string, year: number): Promise<CategorizedParcel[]> {
    const parcels = await this.parcelRepository.find({ where: { clusterId } });
    if (parcels.length === 0) return [];
    const parcelIds = parcels.map((p) => p.id);

    const historicalStates = await this.historicalStateRepository.find({ where: { parcelId: In(parcelIds), year } });
    const restrictionByParcel = new Map(historicalStates.map((s) => [s.parcelId, s.restrictionStatus]));

    // Same "current year only" rule as compare() above - DisputeRecord has
    // no per-year history to draw on for any other year.
    const disputeByParcel = new Map<string, DisputeRecord>();
    if (year === CURRENT_YEAR) {
      const disputes = await this.disputeRepository.find({ where: { parcelId: In(parcelIds) } });
      for (const d of disputes) disputeByParcel.set(d.parcelId, d);
    }

    return parcels.map((parcel) => ({
      id: parcel.id,
      canonicalParcelId: parcel.canonicalParcelId,
      ulpin: parcel.ulpin,
      stateCode: parcel.stateCode,
      districtCode: parcel.districtCode,
      localBodyCode: parcel.localBodyCode,
      areaSqM: parcel.areaSqM,
      geometry: parcel.geometry,
      category: categoryFor(
        restrictionByParcel.get(parcel.id) ?? null,
        year === CURRENT_YEAR ? disputeByParcel.get(parcel.id) ?? null : null,
      ),
    }));
  }

  async compare(clusterId: string, fromYear: number, toYear: number): Promise<HistoricalComparisonResult> {
    const [fromSnapshot, toSnapshot] = await Promise.all([
      this.snapshotRepository.findOneBy({ clusterId, year: fromYear }),
      this.snapshotRepository.findOneBy({ clusterId, year: toYear }),
    ]);
    if (!fromSnapshot || !toSnapshot) {
      throw new NotFoundException(`Missing a snapshot for cluster ${clusterId} covering ${fromYear} and/or ${toYear}`);
    }

    const parcels = await this.parcelRepository.find({ where: { clusterId } });
    if (parcels.length === 0) {
      return { clusterId, fromYear, toYear, changeDetected: false, affectedParcels: [] };
    }
    const parcelIds = parcels.map((p) => p.id);

    const historicalStates = await this.historicalStateRepository.find({
      where: { parcelId: In(parcelIds), year: In([fromYear, toYear]) },
    });
    const restrictionByParcelYear = new Map<string, Map<number, string | null>>();
    for (const state of historicalStates) {
      const byYear = restrictionByParcelYear.get(state.parcelId) ?? new Map();
      byYear.set(state.year, state.restrictionStatus);
      restrictionByParcelYear.set(state.parcelId, byYear);
    }

    // DisputeRecord has no per-year history - only relevant when comparing
    // against CURRENT_YEAR, and only fetched then.
    const needsDispute = fromYear === CURRENT_YEAR || toYear === CURRENT_YEAR;
    const disputeByParcel = new Map<string, DisputeRecord>();
    if (needsDispute) {
      const disputes = await this.disputeRepository.find({ where: { parcelId: In(parcelIds) } });
      for (const d of disputes) disputeByParcel.set(d.parcelId, d);
    }

    const affected: { parcel: Parcel; fromCategory: ParcelCategory; toCategory: ParcelCategory }[] = [];
    for (const parcel of parcels) {
      const dispute = disputeByParcel.get(parcel.id) ?? null;
      const byYear = restrictionByParcelYear.get(parcel.id);
      const fromCategory = categoryFor(byYear?.get(fromYear) ?? null, fromYear === CURRENT_YEAR ? dispute : null);
      const toCategory = categoryFor(byYear?.get(toYear) ?? null, toYear === CURRENT_YEAR ? dispute : null);
      if (fromCategory !== toCategory) affected.push({ parcel, fromCategory, toCategory });
    }

    if (affected.length === 0) {
      return { clusterId, fromYear, toYear, changeDetected: false, affectedParcels: [] };
    }

    // Falls back to the real DB id when canonicalParcelId is unset (the
    // column is nullable on Parcel, though seed.ts always populates it) - a
    // stable, non-null string is needed both to key the LLM's per-parcel
    // reply and to key facts/narratives lookups below.
    const displayId = (parcel: Parcel) => parcel.canonicalParcelId ?? parcel.id;

    const facts = new Map<string, string>();
    for (const a of affected) {
      facts.set(a.parcel.id, buildFactSentence(a.fromCategory, a.toCategory, disputeByParcel.get(a.parcel.id) ?? null, toYear));
    }

    // A failed/unconfigured LLM call shouldn't block the deterministic part
    // of this feature - same "external dependency failure doesn't fail the
    // whole operation" pattern as AuthService.register/addOrChangeContact.
    //
    // The LLM call is only asked to cover MAX_LLM_NARRATIVE_PARCELS of the
    // affected parcels (disputes first, since they're the more severe
    // category) - a live test comparing a 100-parcel cluster across its full
    // date range came back with 31 affected parcels; even text-only (see
    // NarrativeService) that took ~25s, so this cap keeps worst-case latency
    // predictable. Every parcel beyond the cap - and any parcel the model's
    // reply doesn't cover - still gets a real, accurate narrative from
    // buildFactSentence below, just not LLM-phrased.
    let narratives = new Map<string, string>();
    try {
      const prioritized = [...affected].sort((a, b) => Number(b.toCategory.startsWith('DISPUTE_')) - Number(a.toCategory.startsWith('DISPUTE_')));
      const changeFacts: ParcelChangeFact[] = prioritized.slice(0, MAX_LLM_NARRATIVE_PARCELS).map((a) => ({
        canonicalParcelId: displayId(a.parcel),
        fromCategory: a.fromCategory,
        toCategory: a.toCategory,
        facts: facts.get(a.parcel.id)!,
      }));
      narratives = await this.narrativeService.explainParcelChanges(fromYear, toYear, changeFacts);
    } catch {
      // Swallowed deliberately - see comment above.
    }

    // Newly-appearing (or worsened) categories on affected parcels that
    // currently ALSO have a real restriction get bumped to CRITICAL - same
    // "dispute inside a restricted zone is worse" cross-check the pixel-diff
    // version had, now keyed directly off real data instead of a bounding
    // box.
    const restrictionRecords = await this.restrictionRepository.find({ where: { parcelId: In(affected.map((a) => a.parcel.id)) } });
    const hasCurrentRestriction = new Map(restrictionRecords.map((r) => [r.parcelId, r.hasRestriction]));

    // Built as one array and saved in a single bulk insert (rather than
    // awaiting each save sequentially in the loop below) - each save is a
    // real network round trip to Postgres, and this cluster's affected list
    // can run into the dozens.
    const narrativeByParcelId = new Map<string, string>();
    const alertsToSave: Partial<GovernanceAlert>[] = [];
    for (const a of affected) {
      const narrative = narratives.get(displayId(a.parcel)) ?? facts.get(a.parcel.id)!;
      narrativeByParcelId.set(a.parcel.id, narrative);
      if (a.toCategory !== 'NONE') {
        const isDispute = a.toCategory.startsWith('DISPUTE_');
        const severity = isDispute ? (hasCurrentRestriction.get(a.parcel.id) ? 'CRITICAL' : 'HIGH') : 'MEDIUM';
        alertsToSave.push({
          parcelId: a.parcel.id,
          alertType: isDispute ? 'DISPUTE_DETECTED' : 'RESTRICTION_DETECTED',
          severity,
          source: 'HISTORICAL_IMAGERY',
          status: 'OPEN',
          explanation: narrative,
        });
      }
    }
    const savedAlerts = alertsToSave.length > 0 ? await this.alertRepository.save(alertsToSave) : [];
    const alertIdByParcelId = new Map(savedAlerts.map((alert) => [alert.parcelId, alert.id]));

    const affectedParcels: AffectedParcelResult[] = affected.map((a) => ({
      parcelId: a.parcel.id,
      canonicalParcelId: displayId(a.parcel),
      fromCategory: a.fromCategory,
      toCategory: a.toCategory,
      narrative: narrativeByParcelId.get(a.parcel.id)!,
      alertId: alertIdByParcelId.get(a.parcel.id) ?? null,
    }));

    return { clusterId, fromYear, toYear, changeDetected: true, affectedParcels };
  }
}

function buildFactSentence(fromCategory: ParcelCategory, toCategory: ParcelCategory, dispute: DisputeRecord | null, toYear: number): string {
  if (toCategory.startsWith('DISPUTE_') && dispute) {
    const filed = dispute.filingDate ? `, filed ${dispute.filingDate}` : '';
    return `Dispute record on file: ${CATEGORY_LABELS[toCategory].toLowerCase()}, status ${dispute.caseStatus}${filed}.`;
  }
  if (toCategory === 'RESTRICTED') {
    return `This parcel's recorded restriction status became RESTRICTED in ${toYear}.`;
  }
  if (toCategory === 'NONE' && fromCategory !== 'NONE') {
    return `The ${CATEGORY_LABELS[fromCategory].toLowerCase()} previously on file for this parcel is no longer active as of ${toYear}.`;
  }
  return `This parcel's status changed from ${CATEGORY_LABELS[fromCategory]} to ${CATEGORY_LABELS[toCategory]} by ${toYear}.`;
}
