import { DataSource } from 'typeorm';
import { Parcel } from './src/parcels/parcel.entity';
import { ParcelIdentifier } from './src/parcels/parcel-identifier.entity';
import { ParcelNeighbour } from './src/parcels/parcel-neighbour.entity';
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
import { GovernanceAlert } from './src/governance/governance-alert.entity';

type Point = [number, number];
type Ring = Point[];

interface ParcelCluster {
  clusterId: string;
  stateCode: string;
  district: string;
  centerLng: number;
  centerLat: number;
  rows: number;
  cols: number;
  spacing: number;
}

// Four geographically real demo regions, each a connected cadastral network
// (not independent scattered polygons): every parcel in a cluster shares its
// clusterId, and adjacent parcels share exact boundary coordinates (see the
// lattice functions below) so the cluster reads as one continuous parcel web.
const CLUSTERS: ParcelCluster[] = [
  { clusterId: 'MH-PUNE-01', stateCode: 'MH', district: 'Pune', centerLng: 73.8567, centerLat: 18.5204, rows: 10, cols: 10, spacing: 0.0015 },
  { clusterId: 'TN-CHENNAI-01', stateCode: 'TN', district: 'Chennai', centerLng: 80.2707, centerLat: 13.0827, rows: 5, cols: 8, spacing: 0.0015 },
  { clusterId: 'KA-BANGALORE-01', stateCode: 'KA', district: 'Bangalore', centerLng: 77.5946, centerLat: 12.9716, rows: 5, cols: 8, spacing: 0.0015 },
  { clusterId: 'DL-NEWDELHI-01', stateCode: 'DL', district: 'New Delhi', centerLng: 77.2090, centerLat: 28.6139, rows: 4, cols: 5, spacing: 0.0015 },
];

function districtCode(district: string): string {
  return district.substring(0, 3).toUpperCase();
}

// Center of grid cell (row, col) - equals the average of the cell's four
// lattice corners (see buildLattice), used for zoning/infrastructure
// placement which doesn't need per-parcel geometry.
function gridCellCenter(cluster: ParcelCluster, row: number, col: number): Point {
  const lng = cluster.centerLng + (col - (cluster.cols - 1) / 2) * cluster.spacing;
  const lat = cluster.centerLat + (row - (cluster.rows - 1) / 2) * cluster.spacing;
  return [lng, lat];
}

// --- Shared-vertex lattice: this is what makes adjacent parcels share exact
// boundary coordinates instead of being independent nearby polygons -------

// (rows+1) x (cols+1) grid of corner points. Each interior point is jittered
// once and then reused by every parcel touching it (up to 4), which is what
// keeps the grid connected while still looking hand-drawn rather than a
// perfect spreadsheet grid.
function buildLattice(cluster: ParcelCluster): Point[][] {
  const jitterMax = cluster.spacing * 0.1;
  const lattice: Point[][] = [];
  for (let r = 0; r <= cluster.rows; r++) {
    const row: Point[] = [];
    for (let c = 0; c <= cluster.cols; c++) {
      const baseLng = cluster.centerLng + (c - cluster.cols / 2) * cluster.spacing;
      const baseLat = cluster.centerLat + (r - cluster.rows / 2) * cluster.spacing;
      row.push([baseLng + (Math.random() - 0.5) * jitterMax, baseLat + (Math.random() - 0.5) * jitterMax]);
    }
    lattice.push(row);
  }
  return lattice;
}

// Perpendicular-jittered midpoint of segment a-b, so a shared edge bows
// slightly instead of being a dead-straight line - still identical on both
// sides since it's computed once and looked up by both parcels.
function edgeMidpoint(a: Point, b: Point, jitterMax: number): Point {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const offset = (Math.random() - 0.5) * jitterMax;
  return [mx + (-dy / len) * offset, my + (dx / len) * offset];
}

interface EdgeMidpoints {
  hMid: Point[][]; // hMid[r][c]: midpoint of lattice[r][c] -> lattice[r][c+1]
  vMid: Point[][]; // vMid[r][c]: midpoint of lattice[r][c] -> lattice[r+1][c]
}

function buildEdgeMidpoints(lattice: Point[][], cluster: ParcelCluster): EdgeMidpoints {
  const jitterMax = cluster.spacing * 0.12;
  const hMid: Point[][] = [];
  for (let r = 0; r <= cluster.rows; r++) {
    const row: Point[] = [];
    for (let c = 0; c < cluster.cols; c++) row.push(edgeMidpoint(lattice[r][c], lattice[r][c + 1], jitterMax));
    hMid.push(row);
  }
  const vMid: Point[][] = [];
  for (let r = 0; r < cluster.rows; r++) {
    const row: Point[] = [];
    for (let c = 0; c <= cluster.cols; c++) row.push(edgeMidpoint(lattice[r][c], lattice[r + 1][c], jitterMax));
    vMid.push(row);
  }
  return { hMid, vMid };
}

// The parcel at (row, col) as an 8-vertex ring built entirely from shared
// lattice corners and shared edge midpoints - by construction it can never
// gap or overlap its neighbours, and any edge it shares with a neighbour is
// pixel-for-pixel (coordinate-for-coordinate) identical on both sides.
function parcelRing(lattice: Point[][], mid: EdgeMidpoints, row: number, col: number): Ring {
  const TL = lattice[row][col];
  const TR = lattice[row][col + 1];
  const BR = lattice[row + 1][col + 1];
  const BL = lattice[row + 1][col];
  const top = mid.hMid[row][col];
  const right = mid.vMid[row][col + 1];
  const bottom = mid.hMid[row + 1][col];
  const left = mid.vMid[row][col];
  return [TL, top, TR, right, BR, bottom, BL, left, TL];
}

// Shoelace formula on a locally-projected (equirectangular) approximation -
// accurate enough for parcels a few tens of metres across.
function polygonAreaSqM(ring: Ring, refLat: number): number {
  const metersPerDegLat = 110540;
  const metersPerDegLng = 111320 * Math.cos((refLat * Math.PI) / 180);
  const pts = ring.map(([lng, lat]) => [lng * metersPerDegLng, lat * metersPerDegLat]);
  let area = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
  }
  return Math.abs(area / 2);
}

function ringCentroid(ring: Ring): Point {
  const pts = ring.slice(0, -1);
  const lng = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
  const lat = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
  return [lng, lat];
}

function pointInPolygon([x, y]: Point, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// A jittered rectangle spanning a range of grid cells (inclusive), used for
// zoning overlays where the parcel *count* needs to land in a target range -
// membership is exact by construction rather than by re-testing intersection.
function buildZoneRectangle(cluster: ParcelCluster, rowRange: [number, number], colRange: [number, number]): string {
  const corners = [
    gridCellCenter(cluster, rowRange[0], colRange[0]),
    gridCellCenter(cluster, rowRange[0], colRange[1]),
    gridCellCenter(cluster, rowRange[1], colRange[1]),
    gridCellCenter(cluster, rowRange[1], colRange[0]),
  ];
  const margin = cluster.spacing * 0.5;
  const jitter = () => (Math.random() - 0.5) * cluster.spacing * 0.15;
  const [minLng, maxLng] = [Math.min(...corners.map((c) => c[0])) - margin, Math.max(...corners.map((c) => c[0])) + margin];
  const [minLat, maxLat] = [Math.min(...corners.map((c) => c[1])) - margin, Math.max(...corners.map((c) => c[1])) + margin];

  const ring: Ring = [
    [minLng + jitter(), minLat + jitter()],
    [maxLng + jitter(), minLat + jitter()],
    [maxLng + jitter(), maxLat + jitter()],
    [minLng + jitter(), maxLat + jitter()],
  ];
  ring.push([ring[0][0], ring[0][1]]);
  return JSON.stringify({ type: 'Polygon', coordinates: [ring] });
}

// A hand-authored irregular polygon (offsets are in multiples of the grid
// spacing) crossing several parcel boundaries diagonally - used for the
// flood restriction zone and the change-detection region. Which parcels it
// affects is worked out afterwards with a real point-in-polygon test against
// each parcel's centroid, so geometry and "affected parcels" stay honest.
function buildIrregularZone(cluster: ParcelCluster, offsets: [number, number][]): { geoJSON: string; ring: Ring } {
  const ring: Ring = offsets.map(([dCol, dRow]) => [
    cluster.centerLng + dCol * cluster.spacing,
    cluster.centerLat + dRow * cluster.spacing,
  ]);
  ring.push([ring[0][0], ring[0][1]]);
  return { geoJSON: JSON.stringify({ type: 'Polygon', coordinates: [ring] }), ring };
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

interface GridEntry {
  parcel: Parcel;
  row: number;
  col: number;
  centroid: Point;
}

// Explicit TOUCHING (shares a full edge - the 4 orthogonal grid neighbours,
// guaranteed by the shared-lattice construction above) and NEARBY (shares
// only a corner - the 4 diagonal grid neighbours) relationships, derived
// from known row/column position rather than recomputed from geometry. This
// is what section 10 of the spec calls "shared grid topology + stored
// neighbour relationships" as the SQLite-appropriate stand-in for
// ST_Touches()/ST_DWithin(). Iterating every cell's full 8-neighbourhood
// naturally produces both directions of each relationship.
function buildNeighbourRows(grid: GridEntry[]): Partial<ParcelNeighbour>[] {
  const byPosition = new Map<string, GridEntry>();
  for (const entry of grid) byPosition.set(`${entry.row}:${entry.col}`, entry);

  const TOUCHING_OFFSETS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const NEARBY_OFFSETS: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  const rows: Partial<ParcelNeighbour>[] = [];
  for (const entry of grid) {
    for (const [dr, dc] of TOUCHING_OFFSETS) {
      const neighbour = byPosition.get(`${entry.row + dr}:${entry.col + dc}`);
      if (neighbour) rows.push({ parcelId: entry.parcel.id, neighbourParcelId: neighbour.parcel.id, relationshipType: 'TOUCHING' });
    }
    for (const [dr, dc] of NEARBY_OFFSETS) {
      const neighbour = byPosition.get(`${entry.row + dr}:${entry.col + dc}`);
      if (neighbour) rows.push({ parcelId: entry.parcel.id, neighbourParcelId: neighbour.parcel.id, relationshipType: 'NEARBY' });
    }
  }
  return rows;
}

async function seedDatabase() {
  console.log('Starting database seeding...');

  const dataSource = new DataSource({
    type: 'sqlite',
    database: process.env.SQLITE_PATH || './data/dev.sqlite',
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
      GovernanceAlert,
    ],
    synchronize: true,
  });

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
    const governanceAlertRepository = dataSource.getRepository(GovernanceAlert);

    // Reset so re-running this script always leaves exactly 200 parcels.
    await governanceAlertRepository.clear();
    await registrationRepository.clear();
    await planningRepository.clear();
    await taxRepository.clear();
    await restrictionRecordRepository.clear();
    await stateARepository.clear();
    await stateBRepository.clear();
    await neighbourRepository.clear();
    await identifierRepository.clear();
    await changeDetectionRepository.clear();
    await restrictionRepository.clear();
    await zoningRepository.clear();
    await infrastructureRepository.clear();
    await parcelRepository.clear();
    console.log('Cleared existing spatial demo data');

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

    // Pune's saved parcels, indexed by grid position, so the zoning /
    // restriction / infrastructure / change-detection demo data below can
    // reference exactly the right parcels.
    const puneGrid: GridEntry[] = [];

    // Built up front (not after the parcel loop, like the other Pune overlay
    // zones) so the Restriction department mock can flag parcels inside it
    // while iterating - reused verbatim by the spatial layer save below.
    const pune = CLUSTERS[0];
    const floodZone = buildIrregularZone(pune, [
      [-2.0, 1.6],
      [-0.4, 2.0],
      [0.8, 0.8],
      [1.8, -0.4],
      [0.9, -1.4],
      [-0.4, -0.8],
      [-1.6, 0.3],
    ]);

    for (const cluster of CLUSTERS) {
      const distCode = districtCode(cluster.district);
      const lattice = buildLattice(cluster);
      const midpoints = buildEdgeMidpoints(lattice, cluster);
      const clusterGrid: GridEntry[] = [];

      for (let row = 0; row < cluster.rows; row++) {
        for (let col = 0; col < cluster.cols; col++) {
          const ring = parcelRing(lattice, midpoints, row, col);
          const centroid = ringCentroid(ring);

          const profile = IDENTIFIER_PROFILES[cluster.stateCode];
          const hasUlpin = profile.some((p) => p.type === 'ULPIN' && Math.random() < p.probability);

          const parcel = new Parcel();
          parcel.canonicalParcelId = `CAN${String(canonicalSeq++).padStart(5, '0')}`;
          parcel.clusterId = cluster.clusterId;
          parcel.ulpin = hasUlpin ? profile.find((p) => p.type === 'ULPIN')!.format() : null;
          parcel.stateCode = cluster.stateCode;
          parcel.districtCode = distCode;
          parcel.localBodyCode = `${cluster.stateCode}LB${String(randInt(0, 999)).padStart(3, '0')}`;
          parcel.geometry = JSON.stringify({ type: 'Polygon', coordinates: [ring] });
          parcel.areaSqM = polygonAreaSqM(ring, centroid[1]);

          const savedParcel = await parcelRepository.save(parcel);
          const gridEntry: GridEntry = { parcel: savedParcel, row, col, centroid };
          clusterGrid.push(gridEntry);
          if (cluster.district === 'Pune') puneGrid.push(gridEntry);

          // The identifier value a Land Records lookup-by-parcel would use to
          // resolve into the state schema below (SURVEY_NUMBER for MH,
          // PLOT_NUMBER for DL) - computed once and reused for both the
          // parcel_identifiers row *and* the state record, so
          // GET /api/v1/land-records/:parcelId can actually find a match
          // instead of the two being independently-random and unrelated.
          let primaryIdentifierValue: string | null = null;
          if (cluster.stateCode === 'MH') {
            primaryIdentifierValue = `${randInt(1, 200)}/${randInt(1, 12)}`;
            stateARecordsToSave.push({
              surveyNumber: primaryIdentifierValue,
              subdivisionNumber: String(randInt(1, 9)),
              ownerName: randomPersonName(),
              villageCode: `VIL${String(randInt(1, 40)).padStart(3, '0')}`,
              areaHectares: Math.round((savedParcel.areaSqM / SQM_PER_HECTARE) * 10000) / 10000,
              recordStatus: 'ACTIVE',
            });
          } else if (cluster.stateCode === 'DL') {
            primaryIdentifierValue = `P-${randInt(1000, 9999)}`;
            stateBRecordsToSave.push({
              plotId: primaryIdentifierValue,
              holderName: randomPersonName(),
              localityId: `LOC${String(randInt(1, 40)).padStart(3, '0')}`,
              landExtentSqft: Math.round(savedParcel.areaSqM * SQFT_PER_SQM * 100) / 100,
              recordCategory: 'Urban',
            });
          }

          // --- Phase 4 mock department records, one per parcel every cluster ---
          const isRegistered = Math.random() < 0.75;
          registrationRecordsToSave.push({
            parcelId: savedParcel.id,
            registrationStatus: isRegistered ? 'REGISTERED' : weightedPick([['PENDING', 2], ['NOT_REGISTERED', 1]]),
            registrationNumber: isRegistered ? `REG-${cluster.stateCode}-${randInt(100000, 999999)}` : null,
            registrationDate: isRegistered ? randomDate(10) : null,
            lastTransactionType: isRegistered ? weightedPick([['SALE', 3], ['GIFT', 1], ['INHERITANCE', 1], ['PARTITION', 1]]) : null,
            lastTransactionDate: isRegistered ? randomDate(5) : null,
          });

          // Pune's landUse mirrors the row-based zoning bands built below
          // (residential rows 0-4, commercial 5-6, agricultural 7-9) so the
          // Planning department mock agrees with the GIS zoning overlay
          // instead of being independently random for the same parcel.
          const landUse =
            cluster.district === 'Pune'
              ? row <= 4
                ? 'RESIDENTIAL'
                : row <= 6
                  ? 'COMMERCIAL'
                  : 'AGRICULTURAL'
              : weightedPick(LAND_USES);
          planningRecordsToSave.push({
            parcelId: savedParcel.id,
            landUse,
            zoningClassification: `${landUse.slice(0, 1)}${landUse.slice(1).toLowerCase()}-${randInt(1, 4)}`,
            masterPlanReference: `${cluster.district} Master Plan ${2020 + randInt(0, 5)}`,
            buildingPermissionStatus: landUse === 'AGRICULTURAL' ? 'NOT_REQUIRED' : weightedPick([['APPROVED', 3], ['PENDING', 1], ['NOT_REQUIRED', 1]]),
          });

          const ratePerSqm = randInt(300, 3000);
          const assessedValue = Math.round(savedParcel.areaSqM * ratePerSqm * 100) / 100;
          const annualTaxAmount = Math.round(assessedValue * (0.003 + Math.random() * 0.007) * 100) / 100;
          const taxStatus = weightedPick<'PAID' | 'PENDING' | 'OVERDUE'>([['PAID', 6], ['PENDING', 3], ['OVERDUE', 1]]);
          taxRecordsToSave.push({
            parcelId: savedParcel.id,
            assessedValue,
            annualTaxAmount,
            taxStatus,
            outstandingAmount: taxStatus === 'PAID' ? 0 : Math.round(annualTaxAmount * (taxStatus === 'OVERDUE' ? 1 : 0.5) * 100) / 100,
            lastPaymentDate: taxStatus === 'PAID' ? randomDate(1) : taxStatus === 'PENDING' ? randomDate(2) : null,
          });

          // Pune parcels inside the flood zone are flagged consistent with
          // the spatial RestrictionZone built below; everyone else gets a
          // small independent chance of an environmental/protected-area flag.
          const inFloodZone = cluster.district === 'Pune' && pointInPolygon(centroid, floodZone.ring);
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
            imposingAuthority: hasRestriction ? `${cluster.stateCode} State Environment Authority` : null,
          });

          // Local Parcel ID - every parcel, every state.
          identifiersToSave.push({
            parcel: savedParcel,
            identifierType: 'LOCAL_PARCEL_ID',
            identifierValue: `${cluster.stateCode}-${distCode}-${String(randInt(0, 9999)).padStart(4, '0')}`,
            sourceState: cluster.stateCode,
            sourceDepartment: 'Land Records',
          });

          // State-specific identifiers (ULPIN already folded into parcel.ulpin above,
          // but also recorded here so it's discoverable through parcel_identifiers too).
          if (hasUlpin) {
            identifiersToSave.push({
              parcel: savedParcel,
              identifierType: 'ULPIN',
              identifierValue: parcel.ulpin!,
              sourceState: cluster.stateCode,
              sourceDepartment: 'Land Records',
            });
          }
          for (const entry of profile) {
            if (entry.type === 'ULPIN') continue;
            const isPrimaryType =
              (cluster.stateCode === 'MH' && entry.type === 'SURVEY_NUMBER') || (cluster.stateCode === 'DL' && entry.type === 'PLOT_NUMBER');
            if (Math.random() < entry.probability) {
              identifiersToSave.push({
                parcel: savedParcel,
                identifierType: entry.type,
                identifierValue: isPrimaryType && primaryIdentifierValue ? primaryIdentifierValue : entry.format(),
                sourceState: cluster.stateCode,
                sourceDepartment: 'Land Records',
              });
            }
          }
        }
      }

      neighbourRowsToSave.push(...buildNeighbourRows(clusterGrid));
      console.log(`Generated ${cluster.rows * cluster.cols} connected parcels for cluster ${cluster.clusterId}`);
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

    const savedNeighbours = await neighbourRepository.save(neighbourRowsToSave);
    console.log(`Saved ${savedNeighbours.length} explicit neighbour relationships (TOUCHING + NEARBY)`);

    // --- Pune spatial demo layers -----------------------------------------
    const findPuneParcelIds = (predicate: (row: number, col: number) => boolean) =>
      puneGrid.filter((p) => predicate(p.row, p.col)).map((p) => p.parcel.id);

    await zoningRepository.save([
      {
        name: 'Pune Residential Zone',
        zoneType: 'RESIDENTIAL',
        stateCode: pune.stateCode,
        district: pune.district,
        geometry: buildZoneRectangle(pune, [0, 4], [0, 9]),
        parcelIds: findPuneParcelIds((row) => row <= 4),
      },
      {
        name: 'Pune Commercial Zone',
        zoneType: 'COMMERCIAL',
        stateCode: pune.stateCode,
        district: pune.district,
        geometry: buildZoneRectangle(pune, [5, 6], [0, 9]),
        parcelIds: findPuneParcelIds((row) => row === 5 || row === 6),
      },
      {
        name: 'Pune Agricultural / Open Zone',
        zoneType: 'AGRICULTURAL',
        stateCode: pune.stateCode,
        district: pune.district,
        geometry: buildZoneRectangle(pune, [7, 9], [0, 9]),
        parcelIds: findPuneParcelIds((row) => row >= 7),
      },
    ]);
    console.log('Saved 3 zoning overlays for Pune (residential/commercial/agricultural)');

    // Flood restriction zone (built earlier, before the parcel loop, so the
    // Restriction department mock could flag parcels inside it while
    // iterating): irregular diagonal band crossing the residential/commercial
    // boundary. Affected parcels are computed by a real point-in-polygon test
    // against each parcel's centroid.
    const floodAffectedIds = puneGrid.filter((p) => pointInPolygon(p.centroid, floodZone.ring)).map((p) => p.parcel.id);
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
    // it, and two electricity points near opposite corners.
    const gridHalfSpan = (pune.rows - 1) / 2 + 0.5;
    await infrastructureRepository.save([
      {
        name: 'Pune Main Road',
        featureType: 'ROAD',
        stateCode: pune.stateCode,
        district: pune.district,
        geometry: JSON.stringify({
          type: 'LineString',
          coordinates: [
            [pune.centerLng - gridHalfSpan * pune.spacing, pune.centerLat],
            [pune.centerLng + gridHalfSpan * pune.spacing, pune.centerLat],
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
            [pune.centerLng, pune.centerLat - gridHalfSpan * pune.spacing],
            [pune.centerLng, pune.centerLat + gridHalfSpan * pune.spacing],
          ],
        }),
      },
      {
        name: 'Pune Substation A',
        featureType: 'ELECTRICITY',
        stateCode: pune.stateCode,
        district: pune.district,
        geometry: JSON.stringify({
          type: 'Point',
          coordinates: gridCellCenter(pune, 0, 0),
        }),
      },
      {
        name: 'Pune Substation B',
        featureType: 'ELECTRICITY',
        stateCode: pune.stateCode,
        district: pune.district,
        geometry: JSON.stringify({
          type: 'Point',
          coordinates: gridCellCenter(pune, pune.rows - 1, pune.cols - 1),
        }),
      },
    ]);
    console.log('Saved 4 infrastructure features (road, water line, 2 electricity points)');

    // Simulated satellite change-detection region, near a corner away from
    // the flood zone, again resolved to affected parcels by point-in-polygon.
    const changeZone = buildIrregularZone(pune, [
      [-4.6, -3.4],
      [-3.2, -3.7],
      [-2.9, -4.6],
      [-4.3, -4.8],
    ]);
    const changeAffectedIds = puneGrid.filter((p) => pointInPolygon(p.centroid, changeZone.ring)).map((p) => p.parcel.id);
    await changeDetectionRepository.save({
      description: 'Simulated change detected between sample imagery T1 and T2 (new construction footprint)',
      stateCode: pune.stateCode,
      district: pune.district,
      geometry: changeZone.geoJSON,
      affectedParcelIds: changeAffectedIds,
    });
    console.log(`Saved change-detection event affecting ${changeAffectedIds.length} parcels`);

    // Governance alerts (Tech.md #34): the officer-facing output of the
    // change-detection pipeline built in Phase 8/9. Derived from spatial/tax
    // data already computed above rather than hand-picked, standing in for
    // that pipeline until it exists: one alert per parcel actually inside the
    // flood restriction zone, one per parcel actually flagged by the
    // simulated change-detection event, and one per parcel whose seeded tax
    // record actually came out OVERDUE.
    const governanceAlertsToSave: Partial<GovernanceAlert>[] = [
      ...floodAffectedIds.map((parcelId) => ({
        parcelId,
        alertType: 'RESTRICTION_ZONE_OVERLAP',
        severity: 'MEDIUM',
        source: 'RESTRICTION_MONITOR',
        explanation:
          'This parcel intersects the Pune flood-prone restriction zone. Any land-use change or construction request here should be reviewed against flood-zone regulations before approval.',
      })),
      ...changeAffectedIds.map((parcelId) => ({
        parcelId,
        alertType: 'UNAUTHORIZED_CHANGE_DETECTED',
        severity: 'HIGH',
        source: 'CHANGE_DETECTION',
        explanation:
          'Comparison of before/after imagery flagged a physical change (e.g. a new construction footprint) in this parcel that is not yet reflected in official land records. Recommend officer review.',
      })),
      ...savedTax
        .filter((record) => record.taxStatus === 'OVERDUE')
        .map((record) => ({
          parcelId: record.parcelId,
          alertType: 'TAX_OVERDUE',
          severity: 'LOW',
          source: 'TAX_MONITOR',
          explanation: `Outstanding property tax of ${record.outstandingAmount} is overdue for this parcel.`,
        })),
    ];
    const savedGovernanceAlerts = await governanceAlertRepository.save(governanceAlertsToSave);
    console.log(`Saved ${savedGovernanceAlerts.length} governance alerts (restriction/change-detection/tax)`);

    const totalParcels = await parcelRepository.count();
    console.log(`Database seeding completed successfully! Total parcels: ${totalParcels}`);
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await dataSource.destroy();
  }
}

seedDatabase();
