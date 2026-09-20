import { http, HttpResponse } from 'msw';

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
  
  // Parcels
  http.get('*/parcels', () => {
    return HttpResponse.json({ parcels: [], total: 0 });
  }),
  http.get('*/parcels/mine', () => {
    return HttpResponse.json({ parcels: [], total: 0 });
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
