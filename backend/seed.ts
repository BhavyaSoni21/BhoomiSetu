import { DataSource } from 'typeorm';
import { Parcel } from './src/parcels/parcel.entity';
import { ParcelIdentifier } from './src/parcels/parcel-identifier.entity';

// Mock data generation function
function generateRandomGeoJSON(): string {
  // Generate a simple polygon within a reasonable geographic bounds
  // Using approximate bounds for India: 68-97°E, 8-37°N
  const minLng = 68 + Math.random() * 29; // 68-97
  const minLat = 8 + Math.random() * 29;  // 8-37

  // Create a small polygon around this point
  const size = 0.01 + Math.random() * 0.02; // 0.01-0.03 degrees (~1-3km)

  const coordinates = [[
    [minLng, minLat],
    [minLng + size, minLat],
    [minLng + size, minLat + size],
    [minLng, minLat + size],
    [minLng, minLat]
  ]];

  return JSON.stringify({
    type: 'Polygon',
    coordinates: coordinates
  });
}

// Generate mock parcel data
async function generateMockParcels(count: number = 200) {
  const states = ['DL', 'MH', 'KA', 'TN', 'WB', 'GJ', 'RJ', 'UP', 'BR', 'AP'];
  const districtsByState: Record<string, string[]> = {
    'DL': ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi'],
    'MH': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad'],
    'KA': ['Bangalore', 'Mysore', 'Hubli', 'Belgaum', 'Mangalore'],
    'TN': ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Tiruchirappalli'],
    'WB': ['Kolkata', 'Howrah', 'Durgapur', 'Siliguri', 'Asansol'],
    'GJ': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar'],
    'RJ': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner'],
    'UP': ['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Meerut'],
    'BR': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga'],
    'AP': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool']
  };

  const parcels = [];

  for (let i = 0; i < count; i++) {
    const stateIndex = Math.floor(Math.random() * states.length);
    const state = states[stateIndex];
    const district = districtsByState[state][Math.floor(Math.random() * districtsByState[state].length)];

    const parcel = new Parcel();
    parcel.canonicalParcelId = `CAN${String(i + 10000).padStart(5, '0')}`;
    parcel.ulpin = Math.random() > 0.7 ? `ULPIN${String(Math.floor(Math.random() * 1000000)).padStart(10, '0')}` : null;
    parcel.stateCode = state;
    parcel.districtCode = district.substring(0, Math.min(3, district.length)).toUpperCase();
    parcel.localBodyCode = `${state}LB${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
    parcel.geometry = generateRandomGeoJSON();
    parcel.areaSqM = 100 + Math.random() * 900; // 100-1000 sqm

    parcels.push(parcel);
  }

  return parcels;
}

// Main seeding function
async function seedDatabase() {
  console.log('Starting database seeding...');

  const dataSource = new DataSource({
    type: 'sqlite',
    database: './data/dev.sqlite',
    entities: [Parcel, ParcelIdentifier],
    synchronize: true,
  });

  try {
    await dataSource.initialize();
    console.log('Database connection established');

    const parcelRepository = dataSource.getRepository(Parcel);
    const parcelIdentifierRepository = dataSource.getRepository(ParcelIdentifier);

    // Generate and save mock parcels
    const parcels = await generateMockParcels(200);
    const savedParcels = await parcelRepository.save(parcels);
    console.log(`Saved ${savedParcels.length} parcels`);

    // Generate identifiers for each parcel
    const identifiers = [];
    for (const parcel of savedParcels) {
      // Add ULPIN if available
      if (parcel.ulpin) {
        const id = new ParcelIdentifier();
        id.parcel = parcel;
        id.identifierType = 'ULPIN';
        id.identifierValue = parcel.ulpin;
        id.sourceState = parcel.stateCode;
        id.sourceDepartment = 'Land Records';
        identifiers.push(id);
      }

      // Add a mock survey number for some parcels (State A style)
      if (Math.random() > 0.3) {
        const id = new ParcelIdentifier();
        id.parcel = parcel;
        id.identifierType = 'SURVEY_NUMBER';
        id.identifierValue = `${Math.floor(Math.random() * 100)}/${Math.floor(Math.random() * 10)}`;
        id.sourceState = parcel.stateCode;
        id.sourceDepartment = 'Land Records';
        identifiers.push(id);
      }

      // Add a mock plot number for some parcels (State B style)
      if (Math.random() > 0.3) {
        const id = new ParcelIdentifier();
        id.parcel = parcel;
        id.identifierType = 'PLOT_NUMBER';
        id.identifierValue = `P-${Math.floor(Math.random() * 10000)}`;
        id.sourceState = parcel.stateCode;
        id.sourceDepartment = 'Land Records';
        identifiers.push(id);
      }

      // Add a local parcel ID
      const id = new ParcelIdentifier();
      id.parcel = parcel;
      id.identifierType = 'LOCAL_PARCEL_ID';
      id.identifierValue = `${parcel.stateCode}-${parcel.districtCode}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
      id.sourceState = parcel.stateCode;
      id.sourceDepartment = 'Land Records';
      identifiers.push(id);
    }

    const savedIdentifiers = await parcelIdentifierRepository.save(identifiers);
    console.log(`Saved ${savedIdentifiers.length} parcel identifiers`);

    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await dataSource.destroy();
  }
}

// Run the seeding function
seedDatabase();