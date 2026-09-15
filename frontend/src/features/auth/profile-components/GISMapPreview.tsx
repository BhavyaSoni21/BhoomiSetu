import React from 'react';
import { useTranslation } from '../../../context/LanguageContext';

interface LegendItem {
  color: string;
  label: string;
}

interface GISMapPreviewProps {
  district?: string;
  taluka?: string;
  assignedVillages?: number;
  zones?: string[];
  legend?: LegendItem[];
}

const GISMapPreview: React.FC<GISMapPreviewProps> = ({
  district = 'Pune',
  taluka = 'Haveli',
  assignedVillages = 12,
  zones = ['Zone A', 'Zone B', 'Zone C'],
  legend,
}) => {
  const { t } = useTranslation();
  const resolvedLegend = legend ?? [
    { color: '#061D15', label: t('gisMapPreview.legend.districtBoundary') },
    { color: '#C87525', label: t('gisMapPreview.legend.talukaBoundary') },
    { color: '#16A34A', label: t('gisMapPreview.legend.assignedArea') },
    { color: '#92400E', label: t('gisMapPreview.legend.parcelBoundary') },
  ];
  return (
    <div className="bg-surface border-2 border-ink shadow-hard-sm p-4" aria-label={t('gisMapPreview.ariaLabel')}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-black uppercase tracking-widest text-ink">{t('gisMapPreview.heading')}</h3>
        <span className="text-[10px] font-bold uppercase tracking-wide text-ink/50">{district} / {taluka}</span>
      </div>
      <div className="aspect-video bg-ink/5 relative overflow-hidden border border-ink/20">
        <svg viewBox="0 0 800 400" className="w-full h-full" aria-hidden="true">
          <rect width="800" height="400" fill="#F5F3EC" />
          <rect x="100" y="50" width="600" height="300" fill="#F5F3EC" stroke="#061D15" strokeWidth="3" rx="4" />
          <text x="400" y="280" textAnchor="middle" fill="#061D15" fontSize="16" fontWeight="800" fontFamily="Montserrat, sans-serif">{district} District</text>
          <rect x="200" y="100" width="400" height="200" fill="#F5F3EC" stroke="#C87525" strokeWidth="3" rx="4" />
          <text x="400" y="200" textAnchor="middle" fill="#061D15" fontSize="12" fontWeight="700" fontFamily="Montserrat, sans-serif">{taluka} Taluka</text>
          <rect x="250" y="130" width="150" height="100" fill="#16A34A" fillOpacity="0.3" stroke="#16A34A" strokeWidth="2" rx="3" />
          <rect x="420" y="150" width="130" height="80" fill="#16A34A" fillOpacity="0.3" stroke="#16A34A" strokeWidth="2" rx="3" />
          <text x="325" y="180" textAnchor="middle" fill="#065F46" fontSize="9" fontWeight="700" fontFamily="Montserrat, sans-serif">Assigned Zone A</text>
          <text x="485" y="188" textAnchor="middle" fill="#065F46" fontSize="9" fontWeight="700" fontFamily="Montserrat, sans-serif">Zone B</text>
          <polygon points="300,150 310,140 320,150 310,160" fill="#92400E" stroke="#061D15" strokeWidth="1" />
          <polygon points="500,170 510,160 520,170 510,180" fill="#92400E" stroke="#061D15" strokeWidth="1" />
          <polygon points="350,250 358,242 366,250 358,258" fill="#92400E" stroke="#061D15" strokeWidth="1" />
          <text x="400" y="370" textAnchor="middle" fill="#061D15" fontSize="10" fontFamily="Montserrat, sans-serif">{assignedVillages} Assigned Villages</text>
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {resolvedLegend.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="w-4 h-4 border border-ink/30" style={{ backgroundColor: item.color }} aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-wide text-ink/50">{item.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {zones.map((zone) => (
          <span key={zone} className="inline-flex items-center gap-1 border-2 border-primary/50 bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            {zone}
          </span>
        ))}
      </div>
    </div>
  );
};

export default GISMapPreview;