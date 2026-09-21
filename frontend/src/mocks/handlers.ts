import { http, HttpResponse } from 'msw';

const citizenParcelA = { id: 'pa', canonicalParcelId: 'CAN-A', ulpin: 'ULPIN-A', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 500, geometry: '{}', streetAddress: null, locality: null };
const citizenParcelB = { id: 'pb', canonicalParcelId: 'CAN-B', ulpin: 'ULPIN-B', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 400, geometry: '{}', streetAddress: null, locality: null };

export const handlers = [
  // Authentication
  http.get('*/auth/me', () => {
    return HttpResponse.json({
      id: 'mock-user-id',
      email: 'mock@example.com',
      name: 'Mock User',
      role: 'CITIZEN'
    });
  }),
  
  // Parcels - return owned parcel for /parcels/mine, and both for /parcels search
  http.get('*/parcels', () => {
    return HttpResponse.json({ parcels: [citizenParcelA, citizenParcelB], total: 2 });
  }),
  http.get('*/parcels/mine', () => {
    return HttpResponse.json({ parcels: [citizenParcelA], total: 1 });
  }),
  http.get('*/parcels/:id/360', () => {
    return HttpResponse.json({
      parcel_id: 'p1',
      identifiers: { ulpin: 'ULPIN123', survey_number: '55/2', plot_number: null, local_identifier: 'MH-PUN-0099' },
      location: { state: 'MH', district: 'PUN', locality: 'VIL555' },
      spatial: { area_sq_m: 26714, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } },
      sources: [],
      departments: {
        landRecords: null, registration: null, planning: null, tax: null, restriction: null, dispute: null
      }
    });
  }),
  
  // Historical Imagery
  http.get('*/historical-imagery/clusters', () => {
    return HttpResponse.json([]);
  }),
  
  // GIS
  http.get('*/gis/clusters-hierarchical', () => {
    return HttpResponse.json([]);
  }),
  
  // Notifications
  http.get('*/notifications', () => {
    return HttpResponse.json({ notifications: [], unreadCount: 0 });
  }),

  // Admin users
  http.get('*/admin/users', () => {
    return HttpResponse.json([]);
  }),
  http.get('*/users', () => {
    return HttpResponse.json([]);
  }),

  // Generic POST/PUT/PATCH/DELETE success fallbacks
  http.post('*', () => {
    return HttpResponse.json({});
  }),
  http.patch('*', () => {
    return HttpResponse.json({});
  }),
  http.put('*', () => {
    return HttpResponse.json({});
  }),
  http.delete('*', () => {
    return HttpResponse.json({});
  })
];
