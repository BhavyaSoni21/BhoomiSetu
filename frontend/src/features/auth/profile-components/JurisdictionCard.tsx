import React from 'react';
import { Map, ExternalLink, Plus, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProfileCard } from './ProfileCard';

interface JurisdictionCardProps {
  onViewMapClick?: () => void;
  assignedCount?: number;
  pendingCount?: number;
  completedCount?: number;
}

export const JurisdictionCard: React.FC<JurisdictionCardProps> = ({
  onViewMapClick,
  assignedCount = 24,
  pendingCount = 7,
  completedCount = 128,
}) => {
  const navigate = useNavigate();
  const handleMapClick = onViewMapClick || (() => navigate('/officer/map'));

  return (
    <ProfileCard
      icon={<Map className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />}
      title="ASSIGNED JURISDICTION & RESPONSIBILITIES"
      className="col-span-1 lg:col-span-2"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Administrative scope & metadata */}
        <div className="lg:col-span-6 space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            <div>
              <span className="text-[11px] font-medium text-text-muted">State</span>
              <p className="text-xs font-semibold text-text-heading">Maharashtra</p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-text-muted">District</span>
              <p className="text-xs font-semibold text-text-heading">Pune</p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-text-muted">Taluka / Subdivision</span>
              <p className="text-xs font-semibold text-text-heading">Haveli</p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-text-muted">Assigned villages</span>
              <p className="text-xs font-semibold text-text-heading">12 villages</p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-text-muted">Assigned survey zones</span>
              <p className="text-xs font-semibold text-text-heading">Zone A, B, C</p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-text-muted">Responsible department</span>
              <p className="text-xs font-semibold text-text-heading">Land Records</p>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-gray-800/60">
            <span className="text-[11px] font-medium text-text-muted">Role scope</span>
            <p className="text-xs font-medium text-text-heading mt-0.5 leading-relaxed">
              Record verification, mutation approval, survey coordination
            </p>
          </div>

          {/* Live request counters */}
          <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-gray-100 dark:border-gray-800/60">
            <div className="bg-surface-2 dark:bg-surface-2/60 p-2.5 rounded-xl">
              <div className="text-xl font-black font-heading text-text-heading">{assignedCount}</div>
              <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mt-0.5">Assigned Requests</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl">
              <div className="text-xl font-black font-heading text-amber-700 dark:text-amber-400">{pendingCount}</div>
              <div className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider mt-0.5">Pending</div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl">
              <div className="text-xl font-black font-heading text-emerald-700 dark:text-emerald-400">{completedCount}</div>
              <div className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider mt-0.5">Completed</div>
            </div>
          </div>
        </div>

        {/* Right: Interactive Map with Boundary Layers Legend */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-3">
          <div className="relative w-full h-48 sm:h-52 rounded-xl overflow-hidden border border-emerald-800/30 bg-[#162e21] shadow-inner flex items-center justify-center">
            {/* SVG GIS Map visual */}
            <svg viewBox="0 0 400 240" className="w-full h-full object-cover">
              {/* Background satellite green */}
              <rect width="400" height="240" fill="#1b3824" />
              <path d="M20,40 Q120,20 220,60 T380,40 L400,240 L0,240 Z" fill="#142c1c" opacity="0.8" />
              
              {/* District Boundary Layer (dashed orange/brown) */}
              <polygon points="40,30 360,20 370,210 50,220" fill="none" stroke="#D97706" strokeWidth="2" strokeDasharray="6,4" />
              
              {/* Taluka Boundary (blue/cyan dashed) */}
              <polygon points="90,50 310,40 320,180 80,190" fill="none" stroke="#38BDF8" strokeWidth="1.8" strokeDasharray="4,3" />
              
              {/* Assigned Area Fill (solid emerald translucent) */}
              <polygon points="120,70 270,60 280,160 110,165" fill="rgba(34, 197, 94, 0.28)" stroke="#22C55E" strokeWidth="2" />
              
              {/* Individual Parcel Boundaries */}
              <polygon points="130,80 180,75 185,120 125,125" fill="rgba(255,255,255,0.06)" stroke="#A7F3D0" strokeWidth="1" strokeDasharray="2,2" />
              <polygon points="185,75 260,70 265,115 190,120" fill="rgba(255,255,255,0.06)" stroke="#A7F3D0" strokeWidth="1" strokeDasharray="2,2" />
              <polygon points="125,125 190,120 195,155 120,160" fill="rgba(255,255,255,0.06)" stroke="#A7F3D0" strokeWidth="1" strokeDasharray="2,2" />

              {/* Center Map Label */}
              <text x="195" y="115" fill="#FFFFFF" fontSize="13" fontWeight="bold" textAnchor="middle" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.8))">
                Pune · Haveli
              </text>
            </svg>

            {/* Map Zoom Controls */}
            <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 bg-black/60 backdrop-blur-md rounded-lg p-0.5 border border-white/20">
              <button type="button" className="w-6 h-6 flex items-center justify-center text-white hover:bg-white/20 rounded transition text-xs font-bold" aria-label="Zoom in">
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="w-6 h-6 flex items-center justify-center text-white hover:bg-white/20 rounded transition text-xs font-bold" aria-label="Zoom out">
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Floating Layer Legend */}
            <div className="absolute top-2.5 left-2.5 bg-black/75 backdrop-blur-md rounded-lg px-2.5 py-1.5 border border-white/15 text-[10px] text-white/90 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-amber-500 border-dashed" />
                <span>District Boundary</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-sky-400 border-dashed" />
                <span>Taluka Boundary</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-green-500/40 border border-green-400 rounded-2xs" />
                <span>Assigned Area</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-emerald-200 border-dotted" />
                <span>Parcel Boundary</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleMapClick}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#0F3D2E] text-white hover:bg-[#166534] text-xs font-semibold shadow-xs transition"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            <span>View Assigned Area on Map</span>
          </button>
        </div>
      </div>
    </ProfileCard>
  );
};

export default JurisdictionCard;