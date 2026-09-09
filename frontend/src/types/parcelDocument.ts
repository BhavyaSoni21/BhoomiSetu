// Shape of GET /parcels/:id/documents - land property papers stored per
// parcel (backend/src/parcels/parcel-document.entity.ts). extractedText/
// filePath are never surfaced here in a form the frontend needs to render
// (the image itself is fetched separately via .../documents/:docId/file).

export interface ParcelDocument {
  id: string;
  parcelId: string;
  documentType: string;
  fileName: string;
  mimeType: string;
  registrationStatus: string; // REGISTERED | UNREGISTERED
  createdAt: string;
}
