import React from 'react';
import { Clock } from 'lucide-react';

interface ComingSoonCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

// Same dashed/reduced-opacity "not live yet" convention already established
// on AdminPortal.tsx's placeholder cards (docs/flow.md §6/§7, rule 8) -
// deliberately distinct from the Citizen Portal's own ComingSoonCard (a
// circular corner badge), since Officer/Admin are both staff surfaces that
// already share this dashed-card language.
const ComingSoonCard: React.FC<ComingSoonCardProps> = ({ icon: Icon, title, description }) => (
  <div className="relative border-2 border-dashed border-ink/40 bg-surface/60 p-5 opacity-75 max-w-xl">
    <span className="absolute top-4 right-4 inline-flex items-center gap-1 bg-accent text-ink border-2 border-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
      <Clock className="w-3 h-3" aria-hidden="true" />
      Coming Soon
    </span>
    <div className="flex items-center gap-2 mb-2 pr-28">
      <Icon className="w-5 h-5 text-ink/50" aria-hidden="true" />
      <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink/70">{title}</h3>
    </div>
    <p className="text-sm text-ink/50 leading-relaxed">{description}</p>
  </div>
);

export default ComingSoonCard;
