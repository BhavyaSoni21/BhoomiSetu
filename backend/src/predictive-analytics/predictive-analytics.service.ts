import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { TaxRecord } from '../departments/tax-record.entity';
import { DisputeRecord } from '../departments/dispute-record.entity';
import { RestrictionRecord } from '../departments/restriction-record.entity';
import { GovernanceAlert } from '../governance/governance-alert.entity';

export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskFactorResult {
  key: 'TAX_DELINQUENCY' | 'ACTIVE_DISPUTE' | 'GOVERNANCE_ALERTS' | 'RESTRICTION';
  label: string;
  weight: number;
  available: boolean;
  score: number; // 0-100, this factor's own contribution before weighting; 0 when unavailable
  rationale: string;
}

export interface RiskScoreResult {
  parcelId: string;
  overallScore: number; // 0-100
  riskBand: RiskBand;
  dataCompleteness: number; // fraction (0-1) of total factor weight backed by a real record
  factors: RiskFactorResult[];
}

// Ownership/encroachment disputes threaten who holds title or the parcel's
// physical extent; boundary/inheritance disputes are typically narrower in
// scope - reflected as a severity ordering, not an arbitrary ranking.
const DISPUTE_TYPE_SEVERITY: Record<string, number> = {
  OWNERSHIP: 90,
  ENCROACHMENT: 80,
  BOUNDARY: 65,
  INHERITANCE: 55,
};

const ALERT_SEVERITY_SCORE: Record<string, number> = {
  CRITICAL: 100,
  HIGH: 70,
  MEDIUM: 40,
  LOW: 15,
};

const RESTRICTION_TYPE_SEVERITY: Record<string, number> = {
  FLOOD_PRONE: 60,
  PROTECTED_AREA: 55,
  ENVIRONMENTAL: 50,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function bandFor(score: number): RiskBand {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

// A transparent, hand-weighted heuristic - deliberately not a trained model
// (docs/FEATURE_AUDIT.md §8 item 8 scopes "predictive analytics" this way;
// this project has no labeled outcome data - real disputes/defaults tied to
// real prior parcel states - to train or validate one against). Every factor
// carries its own plain-language rationale alongside the number specifically
// so a score is defensible/auditable rather than a black box: an officer or
// citizen can see exactly which real records produced it.
//
// Weights (tax 0.4 / dispute 0.3 / alerts 0.2 / restriction 0.1) rank the
// factors by how directly each threatens continued, undisputed ownership -
// tax delinquency is the most common and mechanical precursor to state
// action, an active dispute directly contests title, an open governance
// alert is a flagged-but-not-yet-adjudicated concern, and a standing
// land-use restriction is a slower-moving constraint. A missing department
// record for a parcel (~most parcels only match a subset of the five mock
// departments - see seed.ts) excludes that factor from the weighted average
// entirely rather than silently scoring it 0, so coverage gaps don't dilute
// a score relative to an equally-risky parcel that simply has more data.
@Injectable()
export class PredictiveAnalyticsService {
  constructor(
    @InjectRepository(Parcel) private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(TaxRecord) private readonly taxRepository: Repository<TaxRecord>,
    @InjectRepository(DisputeRecord) private readonly disputeRepository: Repository<DisputeRecord>,
    @InjectRepository(RestrictionRecord) private readonly restrictionRepository: Repository<RestrictionRecord>,
    @InjectRepository(GovernanceAlert) private readonly alertRepository: Repository<GovernanceAlert>,
  ) {}

  private scoreTaxFactor(tax: TaxRecord | null): RiskFactorResult {
    const weight = 0.4;
    const label = 'Tax Delinquency';
    if (!tax) {
      return { key: 'TAX_DELINQUENCY', label, weight, available: false, score: 0, rationale: 'No tax record on file for this parcel.' };
    }

    // TypeORM's sqlite driver can return decimal columns as strings; coerce
    // explicitly rather than relying on the entity's declared `number` type.
    const assessedValue = Number(tax.assessedValue);
    const outstandingAmount = Number(tax.outstandingAmount);

    let score: number;
    let rationale: string;
    if (tax.taxStatus === 'OVERDUE') {
      const ratio = assessedValue > 0 ? outstandingAmount / assessedValue : 0;
      const bonus = clamp(ratio * 400, 0, 40);
      score = Math.round(clamp(60 + bonus, 0, 100));
      rationale = `Tax status is OVERDUE with ₹${outstandingAmount.toLocaleString('en-IN')} outstanding (${(ratio * 100).toFixed(1)}% of assessed value).`;
    } else if (tax.taxStatus === 'PENDING') {
      score = 25;
      rationale = 'Tax status is PENDING (payment cycle in progress, not yet overdue).';
    } else {
      score = 0;
      rationale = 'Tax status is PAID.';
    }
    return { key: 'TAX_DELINQUENCY', label, weight, available: true, score, rationale };
  }

  private scoreDisputeFactor(dispute: DisputeRecord | null): RiskFactorResult {
    const weight = 0.3;
    const label = 'Dispute Exposure';
    if (!dispute) {
      return { key: 'ACTIVE_DISPUTE', label, weight, available: false, score: 0, rationale: 'No dispute record on file for this parcel.' };
    }
    if (dispute.hasActiveDispute && dispute.disputeType) {
      const score = DISPUTE_TYPE_SEVERITY[dispute.disputeType] ?? 60;
      const statusLabel = (dispute.caseStatus ?? 'open').toLowerCase().replace(/_/g, ' ');
      return {
        key: 'ACTIVE_DISPUTE',
        label,
        weight,
        available: true,
        score,
        rationale: `An active ${dispute.disputeType.toLowerCase()} dispute is ${statusLabel}.`,
      };
    }
    return {
      key: 'ACTIVE_DISPUTE',
      label,
      weight,
      available: true,
      score: 0,
      rationale: dispute.caseStatus ? `Prior dispute is ${dispute.caseStatus.toLowerCase()}; no active dispute.` : 'No active dispute.',
    };
  }

  private scoreAlertFactor(openAlerts: GovernanceAlert[]): RiskFactorResult {
    const weight = 0.2;
    const label = 'Open Governance Alerts';
    if (openAlerts.length === 0) {
      return { key: 'GOVERNANCE_ALERTS', label, weight, available: true, score: 0, rationale: 'No open governance alerts.' };
    }
    const worst = openAlerts.reduce((max, alert) =>
      (ALERT_SEVERITY_SCORE[alert.severity] ?? 0) > (ALERT_SEVERITY_SCORE[max.severity] ?? 0) ? alert : max,
    );
    const score = ALERT_SEVERITY_SCORE[worst.severity] ?? 0;
    return {
      key: 'GOVERNANCE_ALERTS',
      label,
      weight,
      available: true,
      score,
      rationale: `${openAlerts.length} open alert(s); most severe is ${worst.severity} (${worst.alertType.replace(/_/g, ' ').toLowerCase()}).`,
    };
  }

  private scoreRestrictionFactor(restriction: RestrictionRecord | null): RiskFactorResult {
    const weight = 0.1;
    const label = 'Land-Use Restriction';
    if (!restriction) {
      return { key: 'RESTRICTION', label, weight, available: false, score: 0, rationale: 'No restriction record on file for this parcel.' };
    }
    if (restriction.hasRestriction) {
      const score = restriction.restrictionType ? RESTRICTION_TYPE_SEVERITY[restriction.restrictionType] ?? 45 : 45;
      const typeLabel = (restriction.restrictionType ?? 'RESTRICTION').toLowerCase().replace(/_/g, ' ');
      return {
        key: 'RESTRICTION',
        label,
        weight,
        available: true,
        score,
        rationale: `Flagged ${typeLabel} by ${restriction.imposingAuthority ?? 'an unspecified authority'}.`,
      };
    }
    return { key: 'RESTRICTION', label, weight, available: true, score: 0, rationale: 'No restriction on file.' };
  }

  private combine(factors: RiskFactorResult[]): { overallScore: number; riskBand: RiskBand; dataCompleteness: number } {
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const availableFactors = factors.filter((f) => f.available);
    const availableWeight = availableFactors.reduce((sum, f) => sum + f.weight, 0);

    if (availableWeight === 0) {
      return { overallScore: 0, riskBand: 'LOW', dataCompleteness: 0 };
    }

    const weightedSum = availableFactors.reduce((sum, f) => sum + f.score * f.weight, 0);
    const overallScore = Math.round(weightedSum / availableWeight);
    return { overallScore, riskBand: bandFor(overallScore), dataCompleteness: Math.round((availableWeight / totalWeight) * 100) / 100 };
  }

  private buildResult(
    parcelId: string,
    tax: TaxRecord | null,
    dispute: DisputeRecord | null,
    restriction: RestrictionRecord | null,
    openAlerts: GovernanceAlert[],
  ): RiskScoreResult {
    const factors = [
      this.scoreTaxFactor(tax),
      this.scoreDisputeFactor(dispute),
      this.scoreAlertFactor(openAlerts),
      this.scoreRestrictionFactor(restriction),
    ];
    const { overallScore, riskBand, dataCompleteness } = this.combine(factors);
    return { parcelId, overallScore, riskBand, dataCompleteness, factors };
  }

  async getRiskScore(parcelId: string): Promise<RiskScoreResult | null> {
    const parcel = await this.parcelRepository.findOneBy({ id: parcelId });
    if (!parcel) return null;

    const [tax, dispute, restriction, openAlerts] = await Promise.all([
      this.taxRepository.findOneBy({ parcelId }),
      this.disputeRepository.findOneBy({ parcelId }),
      this.restrictionRepository.findOneBy({ parcelId }),
      this.alertRepository.find({ where: { parcelId, status: 'OPEN' } }),
    ]);

    return this.buildResult(parcelId, tax, dispute, restriction, openAlerts);
  }

  // Scores every parcel and returns the top `limit` by score. Computed
  // in-process over bulk-fetched tables (no per-parcel N+1 queries) rather
  // than in SQL, since the weighting/rationale logic above isn't expressible
  // as a GROUP BY - acceptable at this project's data volumes (hundreds of
  // seeded parcels), but a real deployment with millions of rows would need
  // this precomputed/cached rather than scored on every request.
  async getTopRiskParcels(limit = 10): Promise<RiskScoreResult[]> {
    const cappedLimit = clamp(Math.trunc(limit) || 10, 1, 100);

    const [parcels, taxRecords, disputeRecords, restrictionRecords, openAlerts] = await Promise.all([
      this.parcelRepository.find(),
      this.taxRepository.find(),
      this.disputeRepository.find(),
      this.restrictionRepository.find(),
      this.alertRepository.find({ where: { status: 'OPEN' } }),
    ]);

    const taxByParcel = new Map(taxRecords.map((r) => [r.parcelId, r]));
    const disputeByParcel = new Map(disputeRecords.map((r) => [r.parcelId, r]));
    const restrictionByParcel = new Map(restrictionRecords.map((r) => [r.parcelId, r]));
    const alertsByParcel = new Map<string, GovernanceAlert[]>();
    for (const alert of openAlerts) {
      const list = alertsByParcel.get(alert.parcelId) ?? [];
      list.push(alert);
      alertsByParcel.set(alert.parcelId, list);
    }

    const scored = parcels.map((parcel) =>
      this.buildResult(
        parcel.id,
        taxByParcel.get(parcel.id) ?? null,
        disputeByParcel.get(parcel.id) ?? null,
        restrictionByParcel.get(parcel.id) ?? null,
        alertsByParcel.get(parcel.id) ?? [],
      ),
    );

    return scored.sort((a, b) => b.overallScore - a.overallScore).slice(0, cappedLimit);
  }
}
