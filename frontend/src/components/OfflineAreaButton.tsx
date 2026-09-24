import React, { useState } from 'react';
import { Download, Check, Loader2 } from 'lucide-react';
import { downloadArea, type DownloadProgress } from '../offline/gis';
import { useNetworkStore } from '../offline/network';

// Spec §10: "Download area" for offline GIS. Warms the service-worker tile +
// parcel caches for the currently-focused cluster/district bounds. Rendered in
// the map controls bar only when a cluster/district is focused.
interface Props {
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  areaId: string;
  label: string;
}

const OfflineAreaButton: React.FC<Props> = ({ bounds, areaId, label }) => {
  const reachable = useNetworkStore((s) => s.reachable);
  const [state, setState] = useState<'idle' | 'downloading' | 'done'>('idle');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);

  const onClick = async () => {
    if (state === 'downloading' || !reachable) return;
    setState('downloading');
    try {
      await downloadArea(
        { id: areaId, label, bounds: [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat] },
        setProgress,
      );
      setState('done');
    } catch {
      setState('idle'); // let the user retry; partial cache is still useful
    }
  };

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;
  const Icon = state === 'done' ? Check : state === 'downloading' ? Loader2 : Download;

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={!reachable || state === 'downloading'}
      className="inline-flex items-center gap-1.5 border-2 border-ink bg-surface px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink transition hover:bg-muted active:translate-x-[2px] active:translate-y-[2px] shrink-0 disabled:opacity-40"
      title={reachable ? 'Cache this area for offline use' : 'Connect to download for offline'}
    >
      <Icon className={`w-3.5 h-3.5 ${state === 'downloading' ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span className="hidden sm:inline">
        {state === 'downloading' ? `${pct}%` : state === 'done' ? 'Saved' : 'Offline'}
      </span>
    </button>
  );
};

export default OfflineAreaButton;
