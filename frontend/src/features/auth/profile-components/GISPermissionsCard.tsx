import React from 'react';
import { Map, ShieldCheck, ExternalLink } from 'lucide-react';
import { ProfileField } from './ProfileField';
import StatusBadge from './StatusBadge';

interface PermissionChipProps {
  label: string;
  scope: 'view' | 'verify' | 'approve' | 'export';
}

const SCOPE_STYLES: Record<PermissionChipProps['scope'], string> = {
  view: 'bg-primary/10 text-primary border-primary/40',
  verify: 'bg-accent/20 text-secondary-strong border-accent/40',
  approve: 'bg-primary/15 text-primary border-primary/50',
  export: 'bg-muted text-ink/70 border-ink/20',
};

const PermissionChip: React.FC<PermissionChipProps> = ({ label, scope }) => {
  return (
    <span className={`inline-flex items-center gap-1.5 border-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${SCOPE_STYLES[scope]}`}>
      {label}
    </span>
  );
};

interface GISPermissionsCardProps {
  onAccessMatrixClick?: () => void;
  onPermissionRequestClick?: () => void;
}

const GISPermissionsCard: React.FC<GISPermissionsCardProps> = ({ onAccessMatrixClick, onPermissionRequestClick }) => {
  const layers = [
    'Cadastral parcel layer',
    'Survey and resurvey layer',
    'Ownership and mutation records',
    'Historical imagery',
    'Drone survey imagery',
    'Land-use classification',
    'Public infrastructure layer',
  ];

  const permissions = [
    { label: 'View/search parcels', scope: 'view' as const },
    { label: 'Verify and annotate records', scope: 'verify' as const },
    { label: 'Raise field inspection requests', scope: 'approve' as const },
    { label: 'Download authorized datasets', scope: 'export' as const },
    { label: 'Access historical imagery', scope: 'view' as const },
  ];

  return (
    <div className="bg-surface border-2 border-ink shadow-hard-md overflow-hidden">
      <div className="border-b-2 border-ink/20 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Map className="w-5 h-5 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink">GIS Access & Permissions</h3>
        </div>
        <div className="flex items-center gap-2">
          {onPermissionRequestClick && (
            <button
              type="button"
              onClick={onPermissionRequestClick}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
            >
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
              Request Permission Change
            </button>
          )}
          {onAccessMatrixClick && (
            <button
              type="button"
              onClick={onAccessMatrixClick}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
            >
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
              View Access Matrix
            </button>
          )}
        </div>
      </div>
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50">Access Level</h4>
          </div>
          <ProfileField label="Role" value="District Land Records Officer" />
          <div className="mt-4">
            <h5 className="text-[11px] font-bold uppercase tracking-widest text-ink/50 mb-3">GIS Layers Available</h5>
            <div className="space-y-2">
              {layers.map((layer) => (
                <div key={layer} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-primary border border-ink" aria-hidden="true" />
                  <span className="text-sm text-ink font-medium">{layer}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-ink/50 mb-3">Permission Scope</h4>
          <div className="flex flex-wrap gap-2 mb-4">
            <PermissionChip label="View" scope="view" />
            <PermissionChip label="Verify" scope="verify" />
            <PermissionChip label="Approve" scope="approve" />
            <PermissionChip label="Export" scope="export" />
          </div>
          <div className="space-y-3">
            {permissions.map((perm) => (
              <div key={perm.label} className="flex items-center justify-between">
                <span className="text-sm text-ink font-medium">{perm.label}</span>
                <PermissionChip label="Granted" scope={perm.scope} />
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-ink/20">
            <ProfileField label="Last permissions review" value="10 Sep 2026" />
            <ProfileField label="Permission administrator" value="District Land Records Administrator" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GISPermissionsCard;