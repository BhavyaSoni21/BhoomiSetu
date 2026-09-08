import React from 'react';
import { MapPinned } from 'lucide-react';
import MapComponent from '../../features/map/MapComponent';

const sectionHeadingClass = 'text-xl sm:text-2xl font-black uppercase tracking-tight font-display text-ink mb-4 flex items-center gap-2';

// General parcel map (docs/FRONTEND_UPGRADE_SPEC.md §5) - no parcels prop
// means MapComponent fetches and renders every parcel itself, the same
// general view /map already gave a signed-in officer before this
// restructuring, just now reachable from inside the Officer Portal's own nav.
const OfficerMapPage: React.FC = () => (
  <div className="bg-surface border-4 border-ink shadow-hard-lg p-4 sm:p-6">
    <h2 className={sectionHeadingClass}>
      <MapPinned className="w-5 h-5 text-secondary" aria-hidden="true" />
      Map
    </h2>
    <MapComponent />
  </div>
);

export default OfficerMapPage;
