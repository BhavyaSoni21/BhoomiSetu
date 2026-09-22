import { http, HttpResponse } from 'msw';

const citizenParcelA = { id: 'pa', canonicalParcelId: 'CAN-A', ulpin: 'ULPIN-A', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 500, geometry: '{}', streetAddress: null, locality: null };
const citizenParcelB = { id: 'pb', canonicalParcelId: 'CAN-B', ulpin: 'ULPIN-B', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 400, geometry: '{}', streetAddress: null, locality: null };

// Default fixtures for the portal-level integration tests (AdminPortal.test,
// OfficerPortal.test) whose mockApi() is empty - they rely on these shared
// defaults. Feature-level tests override with server.use().
const adminUserFixture = { id: 'u1', name: 'Rina Admin', email: 'admin@test.gov.in', role: 'ADMIN', createdAt: '2026-01-01T00:00:00.000Z' };

const pendingWorkflow = {
  id: 'wf-pending', parcelId: 'p1', workflowType: 'ROR_COPY_REQUEST', currentStatus: 'SUBMITTED',
  createdBy: null, requestDetails: null, lastRemarks: null, createdAt: '', updatedAt: '',
  steps: [
    { id: 's1', stepOrder: 1, department: 'LAND_RECORDS', assignedRole: 'LAND_RECORD_OFFICER', status: 'PENDING', action: null, remarks: null, completedAt: null },
    { id: 's2', stepOrder: 2, department: 'REGISTRATION', assignedRole: 'REGISTRATION_OFFICER', status: 'PENDING', action: null, remarks: null, completedAt: null },
    { id: 's3', stepOrder: 3, department: 'PLANNING', assignedRole: 'PLANNING_OFFICER', status: 'PENDING', action: null, remarks: null, completedAt: null },
  ],
};
// LAND_RECORDS step completed today so "Verified Today"/"Documents Processed" count it.
const decidedWorkflow = () => ({
  id: 'wf-decided', parcelId: 'p2', workflowType: 'CORRECTION_REQUEST', currentStatus: 'IN_PROGRESS',
  createdBy: null, requestDetails: null, lastRemarks: null, createdAt: '', updatedAt: '',
  steps: [
    { id: 's4', stepOrder: 1, department: 'LAND_RECORDS', assignedRole: 'LAND_RECORD_OFFICER', status: 'APPROVED', action: 'APPROVE', remarks: null, completedAt: new Date().toISOString() },
    { id: 's5', stepOrder: 2, department: 'REGISTRATION', assignedRole: 'REGISTRATION_OFFICER', status: 'PENDING', action: null, remarks: null, completedAt: null },
    { id: 's6', stepOrder: 3, department: 'PLANNING', assignedRole: 'PLANNING_OFFICER', status: 'PENDING', action: null, remarks: null, completedAt: null },
  ],
});

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
  
  // Historical Imagery - default cluster so deep-linked ?cluster= tests resolve
  http.get('*/historical-imagery/clusters', () => {
    return HttpResponse.json([
      { clusterId: 'MH-PUNE-01', stateCode: 'MH', district: 'Pune', name: 'Pune City', years: [2016, 2020, 2024] },
    ]);
  }),
  http.get('*/historical-imagery/clusters/*/years/*/parcels', () => HttpResponse.json([])),
  
  // GIS
  http.get('*/gis/clusters-hierarchical', () => {
    return HttpResponse.json([]);
  }),

  // Change Detection Clusters
  http.get('*/change-detection/clusters', () => {
    return HttpResponse.json([
      {
        clusterId: 'pune-cluster-1',
        stateCode: 'MH',
        district: 'Pune',
        type: 'city',
        bounds: { minLng: 73.8492, minLat: 18.5129, maxLng: 73.8642, maxLat: 18.5279 },
      },
    ]);
  }),
  
  // Notifications
  http.get('*/notifications', () => {
    return HttpResponse.json({ notifications: [], unreadCount: 0 });
  }),

  // Admin users
  http.get('*/admin/users', () => {
    return HttpResponse.json([adminUserFixture]);
  }),
  http.get('*/users', () => {
    return HttpResponse.json([adminUserFixture]);
  }),

  // Admin dashboard / monitoring defaults (AdminPortal.test relies on these)
  http.get('*/admin/departments', () => HttpResponse.json([])),
  http.get('*/analytics/officer-monitoring', () => HttpResponse.json([])),
  http.get('*/analytics/summary', () => HttpResponse.json({
    totals: { totalUsers: 5, recentLogins24h: 2, parcels: 0, workflows: 0, openAlerts: 0, activeDisputes: 0 },
    workflowStatusDistribution: [], workflowTypeDistribution: [], disputeCaseStatusDistribution: [],
    alertStatusDistribution: [], alertSeverityDistribution: [], taxStatusDistribution: [],
    registrationStatusDistribution: [], landUseDistribution: [],
  })),
  http.get('*/audit', () => HttpResponse.json([])),
  http.get('*/governance-alerts', () => HttpResponse.json([])),

  // Officer workflows (OfficerPortal.test relies on these)
  http.get('*/workflows/*/field-evidence', () => HttpResponse.json([])),
  http.get('*/workflows/:id', () => HttpResponse.json(pendingWorkflow)),
  http.get('*/workflows', () => HttpResponse.json([pendingWorkflow, decidedWorkflow()])),

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
