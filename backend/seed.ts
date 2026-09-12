import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { getDatabaseConnectionOptions } from './src/database.config';
import { CLUSTER_CONFIGS, GeneratedParcel, Point, Ring, generateClusterParcels } from './src/common/parcel-generation/cluster-generator';
import { computeClusterBounds, renderClusterSnapshot } from './src/common/parcel-generation/cluster-snapshot-generator';
import { renderParcelDocumentImage } from './src/common/parcel-generation/parcel-document-generator';
import { extractText } from './src/document-verification/ocr';
import { ensureStorageBucketExists, uploadToStorage } from './src/common/supabase-storage';
import { categoryFor, CURRENT_YEAR } from './src/common/parcel-generation/parcel-category';
import { pointInRing, polygonDistanceMeters } from './src/common/geo-utils';
import { Parcel } from './src/parcels/parcel.entity';
import { ParcelIdentifier } from './src/parcels/parcel-identifier.entity';
import { ParcelNeighbour } from './src/parcels/parcel-neighbour.entity';
import { CitizenParcel } from './src/parcels/citizen-parcel.entity';
import { ParcelDocument } from './src/parcels/parcel-document.entity';
import { ZoningOverlay } from './src/spatial/zoning-overlay.entity';
import { RestrictionZone } from './src/spatial/restriction-zone.entity';
import { InfrastructureFeature } from './src/spatial/infrastructure-feature.entity';
import { ChangeDetectionEvent } from './src/spatial/change-detection-event.entity';
import { StateALandRecord } from './src/land-records/state-a-land-record.entity';
import { StateBLandRecord } from './src/land-records/state-b-land-record.entity';
import { RegistrationRecord } from './src/departments/registration-record.entity';
import { PlanningRecord } from './src/departments/planning-record.entity';
import { TaxRecord } from './src/departments/tax-record.entity';
import { RestrictionRecord } from './src/departments/restriction-record.entity';
import { DisputeRecord } from './src/departments/dispute-record.entity';
import { EncumbranceRecord } from './src/departments/encumbrance-record.entity';
import { OwnershipHistoryRecord } from './src/parcels/ownership-history-record.entity';
import { ParcelHistoricalState } from './src/parcels/parcel-historical-state.entity';
import { ClusterHistoricalSnapshot } from './src/historical-imagery/cluster-historical-snapshot.entity';
import { GovernanceAlert } from './src/governance/governance-alert.entity';
import { User } from './src/users/user.entity';
import { Department } from './src/admin/department.entity';

function districtCode(district: string): string {
  return district.substring(0, 3).toUpperCase();
}

interface Bounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

function boundsOfRings(rings: Ring[]): Bounds {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return { minLng, minLat, maxLng, maxLat };
}

// A rectangle spanning a fraction-of-bounds window (e.g. latFracRange
// [0, 0.5] = the southern half of the cluster's actual generated footprint)
// instead of a fixed grid-cell range - works regardless of the cluster's
// actual irregular shape/orientation, replacing the old lattice-relative
// buildZoneRectangle.
function buildZoneRectangleFromBounds(bounds: Bounds, latFracRange: [number, number]): string {
  const latSpan = bounds.maxLat - bounds.minLat;
  const margin = latSpan * 0.03;
  const jitter = () => (Math.random() - 0.5) * latSpan * 0.02;
  const minLat = bounds.minLat + latFracRange[0] * latSpan - margin;
  const maxLat = bounds.minLat + latFracRange[1] * latSpan + margin;
  const minLng = bounds.minLng - (bounds.maxLng - bounds.minLng) * 0.03;
  const maxLng = bounds.maxLng + (bounds.maxLng - bounds.minLng) * 0.03;

  const ring: Point[] = [
    [minLng + jitter(), minLat + jitter()],
    [maxLng + jitter(), minLat + jitter()],
    [maxLng + jitter(), maxLat + jitter()],
    [minLng + jitter(), maxLat + jitter()],
  ];
  ring.push([ring[0][0], ring[0][1]]);
  return JSON.stringify({ type: 'Polygon', coordinates: [ring] });
}

// A small irregular polygon (hand-jittered, 6-sided) centered on a real
// point and sized in meters - anchors the flood/change-detection demo zones
// to wherever a cluster's parcels actually generated, instead of a blind
// fraction-of-bounding-box guess that can land in the empty space outside an
// irregular (non-rectangular) envelope's convex hull.
function buildZoneAroundPoint(center: Point, radiusMeters: number, refLat: number): { geoJSON: string; ring: Ring } {
  const metersPerDegLat = 110540;
  const metersPerDegLng = 111320 * Math.cos((refLat * Math.PI) / 180);
  const sides = 6;
  const ring: Ring = [];
  for (let k = 0; k < sides; k++) {
    const theta = (k / sides) * 2 * Math.PI + (Math.random() - 0.5) * ((2 * Math.PI) / sides) * 0.5;
    const r = radiusMeters * (0.75 + Math.random() * 0.4);
    const dx = Math.cos(theta) * r;
    const dy = Math.sin(theta) * r;
    ring.push([center[0] + dx / metersPerDegLng, center[1] + dy / metersPerDegLat]);
  }
  ring.push([ring[0][0], ring[0][1]]);
  return { geoJSON: JSON.stringify({ type: 'Polygon', coordinates: [ring] }), ring };
}

// Grows/shrinks buildZoneAroundPoint's radius until the number of centroids
// it captures lands in targetRange, so a demo zone reliably affects "a
// plausible handful of parcels" regardless of how the randomized subdivision
// happened to lay out parcels near the chosen anchor this run.
function buildZoneHittingTarget(
  points: { centroid: Point }[],
  anchor: Point,
  refLat: number,
  targetRange: [number, number],
  startRadiusMeters: number,
): { geoJSON: string; ring: Ring; affectedCount: number } {
  let radius = startRadiusMeters;
  let zone = buildZoneAroundPoint(anchor, radius, refLat);
  let count = points.filter((p) => pointInRing(p.centroid, zone.ring)).length;
  for (let attempt = 0; attempt < 6 && (count < targetRange[0] || count > targetRange[1]); attempt++) {
    radius *= count < targetRange[0] ? 1.35 : 0.75;
    zone = buildZoneAroundPoint(anchor, radius, refLat);
    count = points.filter((p) => pointInRing(p.centroid, zone.ring)).length;
  }
  return { ...zone, affectedCount: count };
}

// The generated centroid closest to (latFrac, lngFrac) within a cluster's
// bounding box, optionally excluding points already inside another zone -
// used to anchor a demo zone at a plausible, deterministically-locatable
// spot ("near the middle", "near a corner") regardless of the cluster's
// actual randomized shape.
function pickAnchor(points: { centroid: Point }[], bounds: Bounds, targetLatFrac: number, targetLngFrac: number, avoid?: Ring): Point {
  const latSpan = bounds.maxLat - bounds.minLat;
  const lngSpan = bounds.maxLng - bounds.minLng;
  let best = points[0].centroid;
  let bestDist = Infinity;
  for (const p of points) {
    if (avoid && pointInRing(p.centroid, avoid)) continue;
    const latFrac = (p.centroid[1] - bounds.minLat) / latSpan;
    const lngFrac = (p.centroid[0] - bounds.minLng) / lngSpan;
    const dist = Math.hypot(latFrac - targetLatFrac, lngFrac - targetLngFrac);
    if (dist < bestDist) { bestDist = dist; best = p.centroid; }
  }
  return best;
}

// Identifier types each state prioritizes, layered on top of the Local
// Parcel ID every parcel always gets. Nothing in the app depends on any one
// of these being present - identifierType is a free-form string throughout.
const IDENTIFIER_PROFILES: Record<string, Array<{ type: string; probability: number; format: () => string }>> = {
  MH: [
    { type: 'SURVEY_NUMBER', probability: 0.9, format: () => `${randInt(1, 200)}/${randInt(1, 12)}` },
    { type: 'ULPIN', probability: 0.5, format: () => `ULPIN${String(randInt(0, 999999)).padStart(10, '0')}` },
  ],
  TN: [
    { type: 'SURVEY_NUMBER', probability: 0.9, format: () => `${randInt(1, 200)}/${randInt(1, 12)}` },
    { type: 'SUBDIVISION_NUMBER', probability: 0.7, format: () => `SUB-${randInt(1, 999)}` },
  ],
  KA: [
    { type: 'SURVEY_NUMBER', probability: 0.9, format: () => `${randInt(1, 200)}/${randInt(1, 12)}` },
    { type: 'HISSA_NUMBER', probability: 0.6, format: () => `${randInt(1, 50)}/${randInt(1, 9)}` },
  ],
  DL: [
    { type: 'PLOT_NUMBER', probability: 0.9, format: () => `P-${randInt(1, 9999)}` },
    { type: 'PROPERTY_NUMBER', probability: 0.6, format: () => `PROP-${randInt(1, 99999)}` },
  ],
  CH: [
    { type: 'PLOT_NUMBER', probability: 0.9, format: () => `SCO-${randInt(1, 999)}` },
    { type: 'SECTOR_NUMBER', probability: 0.7, format: () => `SECTOR-${randInt(1, 47)}` },
  ],
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const FIRST_NAMES = ['Amit', 'Priya', 'Rahul', 'Sneha', 'Vikram', 'Anjali', 'Suresh', 'Kavita', 'Ravi', 'Meera', 'Arjun', 'Pooja'];
const LAST_NAMES = ['Sharma', 'Patil', 'Reddy', 'Gupta', 'Kumar', 'Iyer', 'Singh', 'Deshmukh', 'Nair', 'Joshi'];

function randomPersonName(): string {
  return `${FIRST_NAMES[randInt(0, FIRST_NAMES.length - 1)]} ${LAST_NAMES[randInt(0, LAST_NAMES.length - 1)]}`;
}

const SQM_PER_HECTARE = 10000;
const SQFT_PER_SQM = 10.7639;

function randomDate(yearsAgoMax: number): string {
  const now = new Date('2026-09-01T00:00:00Z');
  const daysAgo = randInt(0, yearsAgoMax * 365);
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function weightedPick<T>(options: Array<[T, number]>): T {
  const total = options.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [value, weight] of options) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return options[options.length - 1][0];
}

const LAND_USES: Array<[string, number]> = [
  ['RESIDENTIAL', 5],
  ['COMMERCIAL', 2],
  ['AGRICULTURAL', 2],
  ['MIXED_USE', 1],
];

interface ClusterParcelEntry {
  parcel: Parcel;
  ring: Ring;
  centroid: Point;
  hasActiveDispute: boolean;
  disputeType: string | null;
  // restrictionStatus for every SNAPSHOT_YEARS year (populated by the
  // per-parcel historical-state loop below) - the historical-imagery
  // snapshot renderer needs this per parcel per year to compute a real
  // ParcelCategory, not just the current live restriction flag.
  restrictionByYear: Map<number, string>;
}

const TOUCH_EPSILON_M = 3; // matches ParcelsService's own TOUCHING threshold
const NEARBY_RADIUS_M = 60; // wide enough to catch the generator's intentional small gaps (5-7m) plus genuinely close unrelated neighbours

// Real geometric TOUCHING/NEARBY classification (docs/FEATURE_AUDIT.md §8
// item 14's own polygonDistanceMeters, also used by ParcelsService's live
// fallback) computed once at seed time, over every pair of parcels within a
// cluster - this is what makes the generator's irregular subdivision
// "produce topology that makes neighbour detection meaningful" (an exact
// shared edge -> distance 0 -> TOUCHING; an intentional small gap ->
// distance a few metres -> NEARBY), replacing the old row/col-adjacency
// lookup that only worked for a uniform grid.
function computeNeighbourRows(entries: ClusterParcelEntry[], refLat: number): Partial<ParcelNeighbour>[] {
  const rows: Partial<ParcelNeighbour>[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const distance = polygonDistanceMeters(entries[i].ring, entries[j].ring, refLat);
      if (distance > NEARBY_RADIUS_M) continue;
      const relationshipType = distance <= TOUCH_EPSILON_M ? 'TOUCHING' : 'NEARBY';
      rows.push({ parcelId: entries[i].parcel.id, neighbourParcelId: entries[j].parcel.id, relationshipType });
      rows.push({ parcelId: entries[j].parcel.id, neighbourParcelId: entries[i].parcel.id, relationshipType });
    }
  }
  return rows;
}

async function seedDatabase() {
  console.log('Starting database seeding...');

  // Same USE_SQLITE/DB_* branching AppModule uses (database.config.ts) - so
  // `npm run seed` targets whichever database the app itself would connect
  // to, SQLite or a real Postgres/PostGIS instance (docs/FEATURE_AUDIT.md §8
  // item 14), without this script needing its own separate config story.
  const dataSource = new DataSource({
    ...getDatabaseConnectionOptions(),
    entities: [
      Parcel,
      ParcelIdentifier,
      ParcelNeighbour,
      ZoningOverlay,
      RestrictionZone,
      InfrastructureFeature,
      ChangeDetectionEvent,
      StateALandRecord,
      StateBLandRecord,
      RegistrationRecord,
      PlanningRecord,
      TaxRecord,
      RestrictionRecord,
      DisputeRecord,
      EncumbranceRecord,
      OwnershipHistoryRecord,
      ParcelHistoricalState,
      ClusterHistoricalSnapshot,
      GovernanceAlert,
      User,
      CitizenParcel,
      ParcelDocument,
      Department,
    ],
  } as DataSourceOptions);

  try {
    await dataSource.initialize();
    console.log('Database connection established');

    const parcelRepository = dataSource.getRepository(Parcel);
    const identifierRepository = dataSource.getRepository(ParcelIdentifier);
    const neighbourRepository = dataSource.getRepository(ParcelNeighbour);
    const zoningRepository = dataSource.getRepository(ZoningOverlay);
    const restrictionRepository = dataSource.getRepository(RestrictionZone);
    const infrastructureRepository = dataSource.getRepository(InfrastructureFeature);
    const changeDetectionRepository = dataSource.getRepository(ChangeDetectionEvent);
    const stateARepository = dataSource.getRepository(StateALandRecord);
    const stateBRepository = dataSource.getRepository(StateBLandRecord);
    const registrationRepository = dataSource.getRepository(RegistrationRecord);
    const planningRepository = dataSource.getRepository(PlanningRecord);
    const taxRepository = dataSource.getRepository(TaxRecord);
    const restrictionRecordRepository = dataSource.getRepository(RestrictionRecord);
    const disputeRecordRepository = dataSource.getRepository(DisputeRecord);
    const encumbranceRecordRepository = dataSource.getRepository(EncumbranceRecord);
    const ownershipHistoryRepository = dataSource.getRepository(OwnershipHistoryRecord);
    const parcelHistoricalStateRepository = dataSource.getRepository(ParcelHistoricalState);
    const clusterHistoricalSnapshotRepository = dataSource.getRepository(ClusterHistoricalSnapshot);
    const governanceAlertRepository = dataSource.getRepository(GovernanceAlert);
    const userRepository = dataSource.getRepository(User);
    const citizenParcelRepository = dataSource.getRepository(CitizenParcel);
    const parcelDocumentRepository = dataSource.getRepository(ParcelDocument);
    const departmentRepository = dataSource.getRepository(Department);

    // Reset so re-running this script always leaves the same parcel count
    // (CLUSTER_CONFIGS.reduce((n, c) => n + c.parcelCount, 0)).
    // Plain DELETE, not .clear()'s TRUNCATE - Postgres refuses to TRUNCATE a
    // table that another table has a live FK constraint pointing at (e.g.
    // parcel_identifiers -> parcels) even once that referencing table's own
    // rows are already gone; caught live seeding against Supabase
    // (docs/FEATURE_AUDIT.md §8 item 14). SQLite never enforced this, so it
    // was invisible until now. Order still matters here: children before
    // the parents they reference.
    const tablesToClear = [
      departmentRepository,
      parcelDocumentRepository,
      citizenParcelRepository, userRepository, governanceAlertRepository, disputeRecordRepository, registrationRepository,
      planningRepository, taxRepository, restrictionRecordRepository, encumbranceRecordRepository, ownershipHistoryRepository,
      parcelHistoricalStateRepository, clusterHistoricalSnapshotRepository,
      stateARepository, stateBRepository,
      neighbourRepository, identifierRepository, changeDetectionRepository, restrictionRepository,
      zoningRepository, infrastructureRepository, parcelRepository,
    ];
    for (const repo of tablesToClear) {
      await repo.createQueryBuilder().delete().execute();
    }
    console.log('Cleared existing spatial demo data');

    // --- PHASE 1: generate every cluster's irregular parcel geometry up
    // front, before building any DB entities. Pune's zoning/restriction/
    // change-detection demo layers below need its actual generated bounding
    // box (an irregular envelope has no a-priori grid to compute one from),
    // so geometry generation has to fully complete before any of that can
    // be built - unlike the old lattice, which could compute a grid cell's
    // center without generating anything else first.
    const generatedByCluster = new Map<string, GeneratedParcel[]>();
    for (const config of CLUSTER_CONFIGS) {
      const generated = generateClusterParcels(config);
      generatedByCluster.set(config.clusterId, generated);
      console.log(`Generated ${generated.length} irregular parcels for cluster ${config.clusterId}`);
    }

    const pune = CLUSTER_CONFIGS[0];
    const puneBounds = boundsOfRings(generatedByCluster.get(pune.clusterId)!.map((p) => p.ring));

    // Built up front (not after the parcel loop, like the other Pune overlay
    // zones) so the Restriction department mock can flag parcels inside it
    // while iterating - reused verbatim by the spatial layer save below.
    // Anchored near the residential/commercial boundary (latFrac 0.5) using
    // Pune's actual generated centroids (available from Phase 1, before any
    // entity is saved), sized to affect a plausible double-digit handful of
    // parcels regardless of this run's randomized layout.
    const puneGenerated = generatedByCluster.get(pune.clusterId)!;
    const floodAnchor = pickAnchor(puneGenerated, puneBounds, 0.5, 0.45);
    const floodZone = buildZoneHittingTarget(puneGenerated, floodAnchor, pune.centerLat, [8, 18], 320);
    console.log(`Flood zone anchored, expecting to affect ~${floodZone.affectedCount} parcels`);

    let canonicalSeq = 10000;
    const identifiersToSave: Partial<ParcelIdentifier>[] = [];
    const neighbourRowsToSave: Partial<ParcelNeighbour>[] = [];
    // Two deliberately different state land-record schemas (Tech.md #12/#13),
    // demonstrating the interoperability challenge: State A (rural/village
    // style) covers the Pune/MH cluster, State B (urban plot style) covers
    // the New Delhi/DL cluster. Each record's area is derived from its real
    // parcel geometry, not an independent random value.
    const stateARecordsToSave: Partial<StateALandRecord>[] = [];
    const stateBRecordsToSave: Partial<StateBLandRecord>[] = [];

    // Phase 4 mock department records - one row per parcel, every cluster,
    // independent of each other and of the canonical model (see
    // src/departments). Generated inline per-parcel below.
    const registrationRecordsToSave: Partial<RegistrationRecord>[] = [];
    const planningRecordsToSave: Partial<PlanningRecord>[] = [];
    const taxRecordsToSave: Partial<TaxRecord>[] = [];
    const restrictionRecordsToSave: Partial<RestrictionRecord>[] = [];
    const disputeRecordsToSave: Partial<DisputeRecord>[] = [];
    const encumbranceRecordsToSave: Partial<EncumbranceRecord>[] = [];
    const ownershipHistoryRecordsToSave: Partial<OwnershipHistoryRecord>[] = [];
    const parcelHistoricalStatesToSave: Partial<ParcelHistoricalState>[] = [];
    const clusterHistoricalSnapshotsToSave: Partial<ClusterHistoricalSnapshot>[] = [];

    // Historical parcel-imagery archive (docs/FRONTEND_UPGRADE_SPEC.md §8) -
    // a small, fixed set of generated PNGs (one per cluster per year), the
    // first place in this codebase that persists a generated image rather
    // than processing an in-memory upload and discarding it. Uploaded to
    // Supabase Storage rather than local disk (2026-09-10) - a hosted
    // deployment's filesystem doesn't survive a redeploy/restart, so a path
    // like backend/uploads/... would 404 once actually deployed.
    // CURRENT_YEAR (2026, see parcel-category.ts) is included alongside the
    // four purely historical years so the year-toggle always has a "now" to
    // compare against; it's the only year rendered with real DisputeRecord-
    // based coloring (see the loop below), everything else is colored by
    // that year's recorded restrictionStatus only.
    const SNAPSHOT_YEARS = [2022, 2023, 2024, 2025, CURRENT_YEAR];
    await ensureStorageBucketExists();

    // Pune's saved parcels, so the zoning / restriction / infrastructure /
    // change-detection demo data below can reference exactly the right
    // parcels.
    const puneEntries: ClusterParcelEntry[] = [];
    // Every saved parcel, every cluster - used below to link a random subset
    // to demo citizen accounts (docs/Plan.md Phase 12).
    const allSavedParcels: Parcel[] = [];
    // Owner name/primary identifier captured per parcel at creation time
    // (below), so the later Land Property Papers step (after citizen links
    // exist) can print a document that matches whichever name/identifier
    // this parcel's own state schema (or ownership history) already
    // recorded, instead of an independently-random name for the same parcel.
    const parcelDocumentInfoById = new Map<string, { ownerName: string; identifierValue: string | null }>();

    // --- PHASE 2: build DB entities + every per-parcel department record
    // from the pre-generated geometry ------------------------------------
    for (const config of CLUSTER_CONFIGS) {
      const distCode = districtCode(config.district);
      const generated = generatedByCluster.get(config.clusterId)!;
      const clusterEntries: ClusterParcelEntry[] = [];

      for (const gp of generated) {
        const profile = IDENTIFIER_PROFILES[config.stateCode];
        const hasUlpin = profile.some((p) => p.type === 'ULPIN' && Math.random() < p.probability);

        const parcel = new Parcel();
        parcel.canonicalParcelId = `CAN${String(canonicalSeq++).padStart(5, '0')}`;
        parcel.clusterId = config.clusterId;
        parcel.ulpin = hasUlpin ? profile.find((p) => p.type === 'ULPIN')!.format() : null;
        parcel.stateCode = config.stateCode;
        parcel.districtCode = distCode;
        parcel.localBodyCode = `${config.stateCode}LB${String(randInt(0, 999)).padStart(3, '0')}`;
        parcel.geometry = JSON.stringify({ type: 'Polygon', coordinates: [gp.ring] });
        parcel.areaSqM = gp.areaSqM;

        const savedParcel = await parcelRepository.save(parcel);
        const entry: ClusterParcelEntry = {
          parcel: savedParcel,
          ring: gp.ring,
          centroid: gp.centroid,
          hasActiveDispute: false,
          disputeType: null,
          restrictionByYear: new Map(),
        };
        clusterEntries.push(entry);
        allSavedParcels.push(savedParcel);
        if (config.district === 'Pune') puneEntries.push(entry);

        // The identifier value a Land Records lookup-by-parcel would use to
        // resolve into the state schema below (SURVEY_NUMBER for MH,
        // PLOT_NUMBER for DL) - computed once and reused for both the
        // parcel_identifiers row *and* the state record, so
        // GET /api/v1/land-records/:parcelId can actually find a match
        // instead of the two being independently-random and unrelated.
        let primaryIdentifierValue: string | null = null;
        // Captured (rather than inlined into the state-record push below) so
        // Ownership History's final row - when a parcel gets one - can match
        // whichever name the state schema already recorded as current owner/
        // holder, instead of being independently random for the same parcel.
        let currentOwnerName: string | null = null;
        if (config.stateCode === 'MH') {
          primaryIdentifierValue = `${randInt(1, 200)}/${randInt(1, 12)}`;
          currentOwnerName = randomPersonName();
          stateARecordsToSave.push({
            surveyNumber: primaryIdentifierValue,
            subdivisionNumber: String(randInt(1, 9)),
            ownerName: currentOwnerName,
            villageCode: `VIL${String(randInt(1, 40)).padStart(3, '0')}`,
            areaHectares: Math.round((savedParcel.areaSqM / SQM_PER_HECTARE) * 10000) / 10000,
            recordStatus: 'ACTIVE',
          });
        } else if (config.stateCode === 'DL') {
          primaryIdentifierValue = `P-${randInt(1000, 9999)}`;
          currentOwnerName = randomPersonName();
          stateBRecordsToSave.push({
            plotId: primaryIdentifierValue,
            holderName: currentOwnerName,
            localityId: `LOC${String(randInt(1, 40)).padStart(3, '0')}`,
            landExtentSqft: Math.round(savedParcel.areaSqM * SQFT_PER_SQM * 100) / 100,
            recordCategory: 'Urban',
          });
        }
        parcelDocumentInfoById.set(savedParcel.id, {
          ownerName: currentOwnerName ?? randomPersonName(),
          identifierValue: primaryIdentifierValue,
        });

        // --- Phase 4 mock department records, one per parcel every cluster ---
        const isRegistered = Math.random() < 0.75;
        registrationRecordsToSave.push({
          parcelId: savedParcel.id,
          registrationStatus: isRegistered ? 'REGISTERED' : weightedPick([['PENDING', 2], ['NOT_REGISTERED', 1]]),
          registrationNumber: isRegistered ? `REG-${config.stateCode}-${randInt(100000, 999999)}` : null,
          registrationDate: isRegistered ? randomDate(10) : null,
          lastTransactionType: isRegistered ? weightedPick([['SALE', 3], ['GIFT', 1], ['INHERITANCE', 1], ['PARTITION', 1]]) : null,
          lastTransactionDate: isRegistered ? randomDate(5) : null,
        });

        // Pune's landUse mirrors the latitude-banded zoning built below
        // (residential south half, commercial next 20%, agricultural north
        // 30% of Pune's actual generated bounding box) so the Planning
        // department mock agrees with the GIS zoning overlay instead of
        // being independently random for the same parcel.
        let landUse: string;
        if (config.district === 'Pune') {
          const latFrac = (gp.centroid[1] - puneBounds.minLat) / (puneBounds.maxLat - puneBounds.minLat);
          landUse = latFrac < 0.5 ? 'RESIDENTIAL' : latFrac < 0.7 ? 'COMMERCIAL' : 'AGRICULTURAL';
        } else {
          landUse = weightedPick(LAND_USES);
        }
        planningRecordsToSave.push({
          parcelId: savedParcel.id,
          landUse,
          zoningClassification: `${landUse.slice(0, 1)}${landUse.slice(1).toLowerCase()}-${randInt(1, 4)}`,
          masterPlanReference: `${config.district} Master Plan ${2020 + randInt(0, 5)}`,
          buildingPermissionStatus: landUse === 'AGRICULTURAL' ? 'NOT_REQUIRED' : weightedPick([['APPROVED', 3], ['PENDING', 1], ['NOT_REQUIRED', 1]]),
        });

        const ratePerSqm = randInt(300, 3000);
        const assessedValue = Math.round(savedParcel.areaSqM * ratePerSqm * 100) / 100;
        const annualTaxAmount = Math.round(assessedValue * (0.003 + Math.random() * 0.007) * 100) / 100;
        const taxStatus = weightedPick<'PAID' | 'PENDING' | 'OVERDUE'>([['PAID', 6], ['PENDING', 3], ['OVERDUE', 1]]);
        // Valuation reference (docs/FEATURE_AUDIT.md §8 item 18) - an
        // independent market/circle-rate figure within a plausible spread of
        // the tax authority's own assessedValue above, not derived from it.
        const marketValueReference = Math.round(assessedValue * (0.85 + Math.random() * 0.4) * 100) / 100;
        taxRecordsToSave.push({
          parcelId: savedParcel.id,
          assessedValue,
          annualTaxAmount,
          taxStatus,
          outstandingAmount: taxStatus === 'PAID' ? 0 : Math.round(annualTaxAmount * (taxStatus === 'OVERDUE' ? 1 : 0.5) * 100) / 100,
          lastPaymentDate: taxStatus === 'PAID' ? randomDate(1) : taxStatus === 'PENDING' ? randomDate(2) : null,
          marketValueReference,
          valuationDate: randomDate(2),
          valuationSource: weightedPick<string>([['CIRCLE_RATE', 2], ['COMPARABLE_SALE', 1]]),
        });

        // Pune parcels inside the flood zone are flagged consistent with
        // the spatial RestrictionZone built below; everyone else gets a
        // small independent chance of an environmental/protected-area flag.
        const inFloodZone = config.district === 'Pune' && pointInRing(gp.centroid, floodZone.ring);
        const hasRestriction = inFloodZone || Math.random() < 0.08;
        const restrictionType = inFloodZone ? 'FLOOD_PRONE' : hasRestriction ? weightedPick(['ENVIRONMENTAL', 'PROTECTED_AREA'].map((t) => [t, 1] as [string, number])) : null;
        restrictionRecordsToSave.push({
          parcelId: savedParcel.id,
          hasRestriction,
          restrictionType,
          restrictionDetails: hasRestriction
            ? restrictionType === 'FLOOD_PRONE'
              ? 'Parcel falls within the designated flood-prone restriction zone'
              : `Parcel flagged for ${restrictionType!.toLowerCase().replace('_', ' ')} review`
            : null,
          imposingAuthority: hasRestriction ? `${config.stateCode} State Environment Authority` : null,
        });

        // Dispute department: same "every parcel gets a record" pattern as
        // the other four mock departments above, so a citizen/officer
        // always gets a real 200 (an actual "no dispute" record) rather
        // than a 404. ~12% of parcels get a real dispute on file.
        const hasDispute = Math.random() < 0.12;
        const disputeType = hasDispute
          ? weightedPick<string>([['OWNERSHIP', 3], ['BOUNDARY', 3], ['INHERITANCE', 2], ['ENCROACHMENT', 2]])
          : null;
        const caseStatus = hasDispute
          ? weightedPick<string>([['FILED', 2], ['UNDER_REVIEW', 2], ['RESOLVED', 3], ['DISMISSED', 1]])
          : null;
        const isClosedCase = caseStatus === 'RESOLVED' || caseStatus === 'DISMISSED';
        const hasActiveDispute = caseStatus === 'FILED' || caseStatus === 'UNDER_REVIEW';
        entry.hasActiveDispute = hasActiveDispute;
        entry.disputeType = hasActiveDispute ? disputeType : null;
        disputeRecordsToSave.push({
          parcelId: savedParcel.id,
          hasActiveDispute,
          disputeType,
          caseStatus,
          filingDate: hasDispute ? randomDate(3) : null,
          resolutionDate: isClosedCase ? randomDate(1) : null,
          resolutionSummary: isClosedCase
            ? caseStatus === 'RESOLVED'
              ? `Dispute resolved in favor of the recorded owner following ${(disputeType as string).toLowerCase()} review.`
              : 'Case dismissed for insufficient evidence.'
            : null,
        });

        // Encumbrance/mortgage department (docs/FEATURE_AUDIT.md §8 item 17):
        // same "independent per-parcel record" pattern as Dispute above,
        // ~15-20% of parcels carry an active mortgage/lien/charge.
        const hasEncumbrance = Math.random() < 0.17;
        const encumbranceType = hasEncumbrance
          ? weightedPick<string>([['MORTGAGE', 3], ['LIEN', 1], ['CHARGE', 1]])
          : null;
        encumbranceRecordsToSave.push({
          parcelId: savedParcel.id,
          hasEncumbrance,
          encumbranceType,
          lenderName: hasEncumbrance ? `${LAST_NAMES[randInt(0, LAST_NAMES.length - 1)]} Co-operative Bank` : null,
          instrumentReference: hasEncumbrance ? `${encumbranceType}-${randInt(100000, 999999)}` : null,
          registeredDate: hasEncumbrance ? randomDate(8) : null,
          dischargeDate: null,
        });

        // Ownership history (docs/FEATURE_AUDIT.md §8a) - a representative
        // subset of parcels (not all 200+), 1-3 prior owners each, ending at
        // whichever name the state schema recorded as current owner/holder
        // when one exists (MH/DL), or a fresh name otherwise (every other
        // state already has no owner-name representation anywhere else).
        if (Math.random() < 0.5) {
          const priorOwnerCount = randInt(1, 3);
          const entryCount = priorOwnerCount + 1; // + the current owner
          // Dates drawn independently, then sorted oldest-first, so the
          // chain is always strictly chronological regardless of how the
          // individual random draws landed (a plain decreasing-bound draw
          // per entry can't guarantee that on its own).
          const dates = Array.from({ length: entryCount }, () => randomDate(20)).sort();
          const chain: Partial<OwnershipHistoryRecord>[] = dates.map((transactionDate, k) => ({
            parcelId: savedParcel.id,
            ownerName: k === entryCount - 1 ? currentOwnerName ?? randomPersonName() : randomPersonName(),
            transactionType: k === 0 ? 'ORIGINAL' : weightedPick<string>([['SALE', 3], ['GIFT', 1], ['INHERITANCE', 1], ['PARTITION', 1]]),
            transactionDate,
            documentReference: k === 0 ? null : `DEED-${randInt(100000, 999999)}`,
          }));
          ownershipHistoryRecordsToSave.push(...chain);
        }

        // Attribute-level history per year, 2022-2026 (docs/CITIZEN_FEATURES_UPGRADE_PLAN.md
        // §3.4, the prerequisite docs/FRONTEND_UPGRADE_SPEC.md §8's imagery-
        // comparison feature cross-checks against). 2026 - the app's current
        // year - is the anchor: its row always matches this parcel's own
        // current landUse/hasRestriction/taxStatus computed above - not
        // independently random - so "current" and "the most recent history
        // row" never silently disagree. Walking backward from 2026, each
        // earlier year has a small independent chance of differing from the
        // year after it, so most parcels get a flat, unremarkable history
        // and a minority show a real change landing on a specific year -
        // exactly the two cases the imagery feature's legitimate-vs-
        // unauthorized check needs to tell apart.
        {
          let historyLandUse = landUse;
          let historyZoning = weightedPick<string>([['APPROVED', 3], ['PENDING', 1], ['NOT_REQUIRED', 1]]);
          let historyRestriction: 'RESTRICTED' | 'UNRESTRICTED' = hasRestriction ? 'RESTRICTED' : 'UNRESTRICTED';
          let historyTax: string = taxStatus;
          for (const year of [CURRENT_YEAR, 2025, 2024, 2023, 2022]) {
            entry.restrictionByYear.set(year, historyRestriction);
            parcelHistoricalStatesToSave.push({
              parcelId: savedParcel.id,
              year,
              landUse: historyLandUse,
              zoningStatus: historyZoning,
              restrictionStatus: historyRestriction,
              taxStatus: historyTax,
            });
            if (Math.random() < 0.12) historyLandUse = weightedPick(LAND_USES);
            if (Math.random() < 0.12) historyZoning = weightedPick<string>([['APPROVED', 3], ['PENDING', 1], ['NOT_REQUIRED', 1]]);
            if (Math.random() < 0.1) historyRestriction = historyRestriction === 'RESTRICTED' ? 'UNRESTRICTED' : 'RESTRICTED';
            if (Math.random() < 0.15) historyTax = weightedPick<string>([['PAID', 6], ['PENDING', 3], ['OVERDUE', 1]]);
          }
        }

        // Local Parcel ID - every parcel, every state.
        identifiersToSave.push({
          parcel: savedParcel,
          identifierType: 'LOCAL_PARCEL_ID',
          identifierValue: `${config.stateCode}-${distCode}-${String(randInt(0, 9999)).padStart(4, '0')}`,
          sourceState: config.stateCode,
          sourceDepartment: 'Land Records',
        });

        // State-specific identifiers (ULPIN already folded into parcel.ulpin above,
        // but also recorded here so it's discoverable through parcel_identifiers too).
        if (hasUlpin) {
          identifiersToSave.push({
            parcel: savedParcel,
            identifierType: 'ULPIN',
            identifierValue: parcel.ulpin!,
            sourceState: config.stateCode,
            sourceDepartment: 'Land Records',
          });
        }
        for (const entry of profile) {
          if (entry.type === 'ULPIN') continue;
          const isPrimaryType =
            (config.stateCode === 'MH' && entry.type === 'SURVEY_NUMBER') || (config.stateCode === 'DL' && entry.type === 'PLOT_NUMBER');
          if (Math.random() < entry.probability) {
            identifiersToSave.push({
              parcel: savedParcel,
              identifierType: entry.type,
              identifierValue: isPrimaryType && primaryIdentifierValue ? primaryIdentifierValue : entry.format(),
              sourceState: config.stateCode,
              sourceDepartment: 'Land Records',
            });
          }
        }
      }

      neighbourRowsToSave.push(...computeNeighbourRows(clusterEntries, config.centerLat));
      console.log(`Built ${clusterEntries.length} parcel entities + department records for cluster ${config.clusterId}`);

      // One snapshot image per year, all five sharing the identical bounding
      // box computed from this cluster's own real (already-saved) parcel
      // boundaries - no image-registration step needed later when comparing
      // two years (docs/FRONTEND_UPGRADE_SPEC.md §8's "key simplification").
      // Each parcel's fill color per year is a real, data-driven
      // ParcelCategory (parcel-category.ts) - restrictionByYear for every
      // year, real current DisputeRecord for CURRENT_YEAR only - not a
      // synthetic randomly-"changed" pixel set (removed 2026-09-08 per the
      // user's follow-up: HistoricalComparisonService now detects what's
      // different between two years by comparing this exact same category,
      // so the render and the diff can never disagree).
      const rings = clusterEntries.map((e) => e.ring);
      const bounds = computeClusterBounds(rings);
      for (const year of SNAPSHOT_YEARS) {
        const categories = clusterEntries.map((e) =>
          categoryFor(e.restrictionByYear.get(year) ?? null, year === CURRENT_YEAR ? e : null),
        );
        const png = await renderClusterSnapshot(rings, bounds, categories);
        const imagePath = `cluster-snapshots/${config.clusterId}-${year}.png`;
        await uploadToStorage(imagePath, png, 'image/png');
        clusterHistoricalSnapshotsToSave.push({ clusterId: config.clusterId, year, imagePath, bounds: JSON.stringify(bounds) });
      }
    }

    const savedIdentifiers = await identifierRepository.save(identifiersToSave);
    console.log(`Saved ${savedIdentifiers.length} parcel identifiers`);

    const savedStateA = await stateARepository.save(stateARecordsToSave);
    console.log(`Saved ${savedStateA.length} State A land records (Pune/MH)`);
    const savedStateB = await stateBRepository.save(stateBRecordsToSave);
    console.log(`Saved ${savedStateB.length} State B land records (New Delhi/DL)`);

    const savedRegistrations = await registrationRepository.save(registrationRecordsToSave);
    console.log(`Saved ${savedRegistrations.length} registration records`);
    const savedPlanning = await planningRepository.save(planningRecordsToSave);
    console.log(`Saved ${savedPlanning.length} planning records`);
    const savedTax = await taxRepository.save(taxRecordsToSave);
    console.log(`Saved ${savedTax.length} tax records`);
    const savedRestrictionRecords = await restrictionRecordRepository.save(restrictionRecordsToSave);
    console.log(`Saved ${savedRestrictionRecords.length} restriction records`);
    const savedDisputeRecords = await disputeRecordRepository.save(disputeRecordsToSave);
    console.log(`Saved ${savedDisputeRecords.length} dispute records`);
    const savedEncumbranceRecords = await encumbranceRecordRepository.save(encumbranceRecordsToSave);
    console.log(`Saved ${savedEncumbranceRecords.length} encumbrance records`);
    const savedOwnershipHistory = await ownershipHistoryRepository.save(ownershipHistoryRecordsToSave);
    console.log(`Saved ${savedOwnershipHistory.length} ownership history records`);
    const savedParcelHistoricalStates = await parcelHistoricalStateRepository.save(parcelHistoricalStatesToSave);
    console.log(`Saved ${savedParcelHistoricalStates.length} parcel historical state records`);
    const savedClusterSnapshots = await clusterHistoricalSnapshotRepository.save(clusterHistoricalSnapshotsToSave);
    console.log(`Saved ${savedClusterSnapshots.length} cluster historical snapshot images (Supabase Storage, bucket 'bhoomisetu-uploads')`);

    const savedNeighbours = await neighbourRepository.save(neighbourRowsToSave);
    console.log(`Saved ${savedNeighbours.length} explicit neighbour relationships (TOUCHING + NEARBY)`);

    // --- Pune spatial demo layers -----------------------------------------
    const findPuneParcelIds = (predicate: (latFrac: number) => boolean) =>
      puneEntries
        .filter((p) => predicate((p.centroid[1] - puneBounds.minLat) / (puneBounds.maxLat - puneBounds.minLat)))
        .map((p) => p.parcel.id);

    await zoningRepository.save([
      {
        name: 'Pune Residential Zone',
        zoneType: 'RESIDENTIAL',
        stateCode: pune.stateCode,
        district: pune.district,
        geometry: buildZoneRectangleFromBounds(puneBounds, [0, 0.5]),
        parcelIds: findPuneParcelIds((latFrac) => latFrac < 0.5),
      },
      {
        name: 'Pune Commercial Zone',
        zoneType: 'COMMERCIAL',
        stateCode: pune.stateCode,
        district: pune.district,
        geometry: buildZoneRectangleFromBounds(puneBounds, [0.5, 0.7]),
        parcelIds: findPuneParcelIds((latFrac) => latFrac >= 0.5 && latFrac < 0.7),
      },
      {
        name: 'Pune Agricultural / Open Zone',
        zoneType: 'AGRICULTURAL',
        stateCode: pune.stateCode,
        district: pune.district,
        geometry: buildZoneRectangleFromBounds(puneBounds, [0.7, 1]),
        parcelIds: findPuneParcelIds((latFrac) => latFrac >= 0.7),
      },
    ]);
    console.log('Saved 3 zoning overlays for Pune (residential/commercial/agricultural)');

    // Flood restriction zone (built earlier, before the parcel loop, so the
    // Restriction department mock could flag parcels inside it while
    // iterating): irregular diagonal band crossing the residential/commercial
    // boundary. Affected parcels are computed by a real point-in-polygon test
    // against each parcel's centroid.
    const floodAffectedIds = puneEntries.filter((p) => pointInRing(p.centroid, floodZone.ring)).map((p) => p.parcel.id);
    await restrictionRepository.save({
      name: 'Pune Flood-Prone Restriction Zone',
      restrictionType: 'FLOOD',
      stateCode: pune.stateCode,
      district: pune.district,
      geometry: floodZone.geoJSON,
      affectedParcelIds: floodAffectedIds,
    });
    console.log(`Saved flood restriction zone affecting ${floodAffectedIds.length} parcels`);

    // Infrastructure: a road bisecting the cluster, a water line crossing
    // it, and two electricity points near opposite corners of Pune's actual
    // generated bounding box.
    const puneLngSpan = puneBounds.maxLng - puneBounds.minLng;
    const puneLatSpan = puneBounds.maxLat - puneBounds.minLat;
    const puneCenterLng = (puneBounds.minLng + puneBounds.maxLng) / 2;
    const puneCenterLat = (puneBounds.minLat + puneBounds.maxLat) / 2;
    const overshoot = 0.08; // slight overhang past the bounding box, matching the old grid-half-span's "+0.5 cell" overshoot
    await infrastructureRepository.save([
      {
        name: 'Pune Main Road',
        featureType: 'ROAD',
        stateCode: pune.stateCode,
        district: pune.district,
        geometry: JSON.stringify({
          type: 'LineString',
          coordinates: [
            [puneBounds.minLng - puneLngSpan * overshoot, puneCenterLat],
            [puneBounds.maxLng + puneLngSpan * overshoot, puneCenterLat],
          ],
        }),
      },
      {
        name: 'Pune Water Utility Line',
        featureType: 'WATER_LINE',
        stateCode: pune.stateCode,
        district: pune.district,
        geometry: JSON.stringify({
          type: 'LineString',
          coordinates: [
            [puneCenterLng, puneBounds.minLat - puneLatSpan * overshoot],
            [puneCenterLng, puneBounds.maxLat + puneLatSpan * overshoot],
          ],
        }),
      },
      {
        name: 'Pune Substation A',
        featureType: 'ELECTRICITY',
        stateCode: pune.stateCode,
        district: pune.district,
        geometry: JSON.stringify({ type: 'Point', coordinates: [puneBounds.minLng + puneLngSpan * 0.05, puneBounds.minLat + puneLatSpan * 0.05] }),
      },
      {
        name: 'Pune Substation B',
        featureType: 'ELECTRICITY',
        stateCode: pune.stateCode,
        district: pune.district,
        geometry: JSON.stringify({ type: 'Point', coordinates: [puneBounds.maxLng - puneLngSpan * 0.05, puneBounds.maxLat - puneLatSpan * 0.05] }),
      },
    ]);
    console.log('Saved 4 infrastructure features (road, water line, 2 electricity points)');

    // Simulated satellite change-detection region, near a corner away from
    // the flood zone, again resolved to affected parcels by point-in-polygon.
    // Anchored near an actual corner of Pune's generated parcels (not the
    // bounding box's own corner, which can fall outside an irregular
    // envelope's convex hull entirely - an early run of this generator did
    // exactly that and produced a zone affecting zero parcels).
    const changeAnchor = pickAnchor(puneEntries, puneBounds, 0.08, 0.08, floodZone.ring);
    const changeZone = buildZoneHittingTarget(puneEntries, changeAnchor, pune.centerLat, [2, 5], 120);
    const changeAffectedIds = puneEntries.filter((p) => pointInRing(p.centroid, changeZone.ring)).map((p) => p.parcel.id);
    await changeDetectionRepository.save({
      description: 'Simulated change detected between sample imagery T1 and T2 (new construction footprint)',
      stateCode: pune.stateCode,
      district: pune.district,
      geometry: changeZone.geoJSON,
      affectedParcelIds: changeAffectedIds,
    });
    console.log(`Saved change-detection event affecting ${changeAffectedIds.length} parcels`);

    // Governance alerts are no longer hand-seeded here (removed 2026-09-10,
    // per the user's explicit "remove the hardcoded alerts from it... I want
    // only the current alerts displayed"). RESTRICTION_ZONE_OVERLAP,
    // UNAUTHORIZED_CHANGE_DETECTED, and TAX_OVERDUE alerts used to be
    // fabricated here from the flood zone/simulated change event/tax records
    // above, disconnected from any real monitor - a governance alert should
    // only ever come from something that actually happened: an admin
    // authoring a real RestrictionZone (SpatialService.createRestrictionZone,
    // real spatial-overlap computation), a real change-detection analysis
    // (POST /change-detection/analyze), or a real historical-year comparison
    // (HistoricalComparisonService.compare, now restricted to CURRENT_YEAR-1
    // -> CURRENT_YEAR only). The flood zone / simulated change event / tax
    // records themselves are still seeded above as real demo data for their
    // own features (Map Layer Authoring, etc.) - only the practice of also
    // fabricating a matching alert for them was removed.

    // Demo accounts for real login (Phase 10, docs/FEATURE_AUDIT.md §8 item 9)
    // - one per officer role plus one admin, all sharing one demo password.
    // Never real credentials: this is seed data for a hackathon prototype,
    // same as every other seeded record in this file.
    const DEMO_PASSWORD_HASH = bcrypt.hashSync('Demo@123', 10);
    // emailVerified: true - admin-provisioned staff accounts are already
    // trusted (docs/flow.md rule 5), no OTP concept applies to them
    // (docs/FRONTEND_UPGRADE_SPEC.md §3), matching UsersController.create()'s
    // own default for a real admin-created account.
    await userRepository.save([
      { email: 'admin@bhoomisetu.gov.in', passwordHash: DEMO_PASSWORD_HASH, name: 'Admin User', role: 'ADMIN', emailVerified: true },
      { email: 'landrecords.officer@bhoomisetu.gov.in', passwordHash: DEMO_PASSWORD_HASH, name: 'Asha Kulkarni', role: 'LAND_RECORD_OFFICER', emailVerified: true },
      { email: 'registration.officer@bhoomisetu.gov.in', passwordHash: DEMO_PASSWORD_HASH, name: 'Rohan Mehta', role: 'REGISTRATION_OFFICER', emailVerified: true },
      { email: 'planning.officer@bhoomisetu.gov.in', passwordHash: DEMO_PASSWORD_HASH, name: 'Priya Nair', role: 'PLANNING_OFFICER', emailVerified: true },
      { email: 'dispute.officer@bhoomisetu.gov.in', passwordHash: DEMO_PASSWORD_HASH, name: 'Vikram Singh', role: 'DISPUTE_OFFICER', emailVerified: true },
      // Added so every department in the admin Department directory
      // (docs/FRONTEND_UPGRADE_SPEC.md §7) has at least one real officer to
      // receive AI-routed requests and governance-alert notifications - see
      // RequestRoutingService/NotificationFeedService.
      { email: 'tax.officer@bhoomisetu.gov.in', passwordHash: DEMO_PASSWORD_HASH, name: 'Meera Iyer', role: 'TAX_OFFICER', emailVerified: true },
      { email: 'restriction.officer@bhoomisetu.gov.in', passwordHash: DEMO_PASSWORD_HASH, name: 'Arjun Deshmukh', role: 'RESTRICTION_OFFICER', emailVerified: true },
      { email: 'encumbrance.officer@bhoomisetu.gov.in', passwordHash: DEMO_PASSWORD_HASH, name: 'Kavita Rao', role: 'ENCUMBRANCE_OFFICER', emailVerified: true },
    ]);
    console.log('Saved 8 demo user accounts (1 admin + 7 officer roles, password: Demo@123)');

    // Optional citizen sign-in (docs/Plan.md Phase 12): each demo citizen
    // account gets linked to a random 0-5 parcels for the "My Parcels"
    // dashboard, weighted so 1-2 parcels is most likely and both 0 and 5 are
    // the least likely - a shuffled, non-repeating walk through every saved
    // parcel, so no parcel is ever linked to more than one citizen.
    const CITIZEN_COUNT = 20;
    const PARCEL_COUNT_WEIGHTS: Array<[number, number]> = [[0, 2], [1, 5], [2, 5], [3, 3], [4, 2], [5, 1]];
    const shuffledParcels = [...allSavedParcels].sort(() => Math.random() - 0.5);
    let parcelCursor = 0;

    const citizensToSave: Partial<User>[] = Array.from({ length: CITIZEN_COUNT }, (_, i) => ({
      email: `citizen${i + 1}@example.com`,
      passwordHash: DEMO_PASSWORD_HASH,
      name: randomPersonName(),
      role: 'CITIZEN',
      // Demo citizens have never gone through the real registration/OTP
      // flow (docs/FRONTEND_UPGRADE_SPEC.md §3) - marked verified so the
      // Profile page shows them as such rather than nudging every demo
      // account to "verify" an email that was never actually theirs to prove.
      emailVerified: true,
    }));
    const savedCitizens = await userRepository.save(citizensToSave);

    const citizenParcelLinksToSave: Partial<CitizenParcel>[] = [];
    for (const citizen of savedCitizens) {
      const parcelCount = weightedPick(PARCEL_COUNT_WEIGHTS);
      for (let j = 0; j < parcelCount && parcelCursor < shuffledParcels.length; j++) {
        citizenParcelLinksToSave.push({ citizen, parcel: shuffledParcels[parcelCursor++] });
      }
    }
    const savedCitizenLinks = await citizenParcelRepository.save(citizenParcelLinksToSave);
    console.log(`Saved ${savedCitizens.length} demo citizen accounts (password: Demo@123), linked to ${savedCitizenLinks.length} parcels total`);

    // Land property papers (docs/FRONTEND_UPGRADE_SPEC.md follow-up) -
    // deliberately partial and messy, not a uniform 1:1 seed: only
    // citizen-linked parcels are even candidates, and even among those only
    // a random subset actually gets a document (a realistic "paperwork
    // genuinely missing" gap, not a bug - every never-linked parcel has none
    // either). Dated as the current year only (CURRENT_YEAR) - no historical
    // versions. Of the parcels that do get one, most are REGISTERED, a
    // smaller share UNREGISTERED, so an officer's Land Claim/Verify
    // Documents queue has real pre-existing unregistered paperwork to act on
    // from day one rather than everything looking freshly pristine.
    const parcelDocumentsToSave: Partial<ParcelDocument>[] = [];
    for (const link of savedCitizenLinks) {
      if (Math.random() >= 0.55) continue;
      const parcel = link.parcel;
      const info = parcelDocumentInfoById.get(parcel.id) ?? { ownerName: randomPersonName(), identifierValue: null };
      const registrationStatus = Math.random() < 0.7 ? 'REGISTERED' : 'UNREGISTERED';

      const png = await renderParcelDocumentImage({
        ownerName: info.ownerName,
        surveyNumber: info.identifierValue ?? 'N/A',
        areaSqM: Number(parcel.areaSqM),
        stateCode: parcel.stateCode,
        districtCode: parcel.districtCode,
        registrationStatus,
      });
      const fileName = `${parcel.id}.png`;
      const filePath = `parcel-documents/${fileName}`;
      await uploadToStorage(filePath, png, 'image/png');
      // OCR'd once here (tesseract.js, same as the old standalone
      // document-verification feature used at request time) and stored, so
      // WorkflowsService's automatic pre-check never re-OCRs it later.
      const { text } = await extractText(png);

      parcelDocumentsToSave.push({
        parcelId: parcel.id,
        documentType: 'ROR_COPY',
        fileName,
        filePath,
        mimeType: 'image/png',
        extractedText: text,
        registrationStatus,
      });
    }
    const savedParcelDocuments = await parcelDocumentRepository.save(parcelDocumentsToSave);
    console.log(`Saved ${savedParcelDocuments.length} parcel documents (land property papers) out of ${savedCitizenLinks.length} citizen-linked parcels`);

    // Admin Portal "Department management" (docs/FRONTEND_UPGRADE_SPEC.md §7,
    // Phase 3) - display/admin metadata only, one row per existing hardcoded
    // department code (ROLE_DEPARTMENT / the 7 mock department modules under
    // src/departments/). Seeded so the admin CRUD page has real starting data
    // to demo against instead of an empty list.
    const savedDepartments = await departmentRepository.save([
      { code: 'LAND_RECORDS', name: 'Land Records', description: 'Survey numbers, ownership records, and title documentation.', contactEmail: 'landrecords@bhoomisetu.gov.in' },
      { code: 'REGISTRATION', name: 'Registration', description: 'Property registration and transaction recording.', contactEmail: 'registration@bhoomisetu.gov.in' },
      { code: 'PLANNING', name: 'Planning', description: 'Zoning classification, land use, and master plan oversight.', contactEmail: 'planning@bhoomisetu.gov.in' },
      { code: 'TAX', name: 'Tax', description: 'Property tax assessment and collection.', contactEmail: 'tax@bhoomisetu.gov.in' },
      { code: 'RESTRICTION', name: 'Restriction', description: 'Environmental, protected-area, and other land-use restrictions.', contactEmail: 'restrictions@bhoomisetu.gov.in' },
      { code: 'DISPUTE', name: 'Dispute', description: 'Ownership, boundary, inheritance, and encroachment dispute resolution.', contactEmail: 'disputes@bhoomisetu.gov.in' },
      { code: 'ENCUMBRANCE', name: 'Encumbrance', description: 'Mortgages, liens, and other charges registered against a parcel.', contactEmail: 'encumbrance@bhoomisetu.gov.in' },
    ]);
    console.log(`Saved ${savedDepartments.length} departments`);

    const totalParcels = await parcelRepository.count();
    console.log(`Database seeding completed successfully! Total parcels: ${totalParcels}`);
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await dataSource.destroy();
  }
}

seedDatabase();
