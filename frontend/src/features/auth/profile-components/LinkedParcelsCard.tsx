import React from 'react';
import { Layers, ArrowRight, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProfileCard } from './ProfileCard';
import { StatusPill } from './StatusPill';
import { ParcelSummary } from '../../../types/parcel';

interface LinkedParcelsCardProps {
  parcels?: ParcelSummary[];
  total?: number;
  registeredCount?: number;
  pendingCount?: number;
}

export const LinkedParcelsCard: React.FC<LinkedParcelsCardProps> = ({
  parcels = [],
  total = 3,
  registeredCount = 3,
  pendingCount = 0,
}) => {
  const displayTotal = total !== undefined ? total : (parcels.length || 3);
  const displayRegistered = registeredCount !== undefined ? registeredCount : displayTotal;
  const displayPending = pendingCount !== undefined ? pendingCount : 0;

  const sampleParcel: Pick<ParcelSummary, 'id' | 'ulpin' | 'areaSqM' | 'districtCode' | 'stateCode'> = parcels[0] || {
    id: 'MH-PUN-1229',
    ulpin: 'MH-PUN-1229',
    areaSqM: 30839,
    districtCode: 'Pune',
    stateCode: 'Maharashtra',
  };

  return (
    <ProfileCard
      icon={<Layers className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />}
      title="LINKED PARCELS"
    >
      <div className="space-y-4">
        {/* Live Counters */}
        <div className="grid grid-cols-2 gap-2 text-center pb-3 border-b border-gray-100 dark:border-gray-800/60">
          <div className="bg-white dark:bg-surface-2/60 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 shadow-2xs">
            <div className="text-xl font-black font-heading text-text-heading leading-none">{displayTotal}{'​'}</div>
            <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mt-1">Parcels Linked</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/60 shadow-2xs">
            <div className="text-xl font-black font-heading text-amber-700 dark:text-amber-400 leading-none">{displayPending}{'​'}</div>
            <div className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider mt-1">Pending Review</div>
          </div>
        </div>

        {/* Mini Map / Parcel Thumbnail */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-surface-2/60 border border-[var(--border)] hover:border-emerald-500/50 transition group">
          {/* Visual Map Chip */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-emerald-900 relative shrink-0 border border-emerald-700/30">
            <svg viewBox="0 0 100 100" className="w-full h-full object-cover">
              {/* Satellite / Terrain grid */}
              <rect width="100" height="100" fill="#234229" />
              <path d="M0,30 Q40,40 100,20 L100,100 L0,100 Z" fill="#1b3820" />
              <polygon points="25,25 75,20 85,75 30,80" fill="rgba(52, 211, 153, 0.25)" stroke="#34D399" strokeWidth="2.5" strokeDasharray="3,2" />
              <circle cx="55" cy="48" r="4" fill="#F59E0B" stroke="#fff" strokeWidth="1.5" />
            </svg>
            <span className="absolute bottom-1 right-1 text-[8px] font-mono font-bold bg-black/60 text-white px-1 py-0.2 rounded">GIS</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-mono font-bold text-text-heading truncate">
                {sampleParcel.ulpin || sampleParcel.id}
              </span>
              <StatusPill status="registered" size="sm" />
            </div>
            <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-text-muted shrink-0" aria-hidden="true" />
              <span>{sampleParcel.districtCode}, {sampleParcel.stateCode}</span>
            </p>
            <p className="text-xs font-mono font-medium text-emerald-700 dark:text-emerald-400 mt-1">
              {sampleParcel.areaSqM.toLocaleString()} m²
            </p>
          </div>
        </div>

        {/* Action link */}
        <div className="pt-1 text-right">
          <Link
            to="/citizen/parcels"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 hover:underline"
          >
            <span>View My Parcels</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </ProfileCard>
  );
};

export default LinkedParcelsCard;
