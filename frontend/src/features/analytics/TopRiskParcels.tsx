import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowUpRight, ShieldAlert } from 'lucide-react';
import apiService from '../../services/apiService';
import { RiskScore } from '../../types/riskScore';
import { useTranslation } from '../../context/LanguageContext';

// Bauhaus status-badge treatment (docs/design.md §7): solid semantic fill +
// ink border rather than the old soft `/10`-tint chip - LOW reads as safe
// (muted/neutral), MEDIUM as caution (accent/gold), HIGH and CRITICAL as
// the two escalating terracotta tones already used for warning states.
const RISK_BAND_CLASS: Record<string, string> = {
  LOW: 'bg-muted text-ink border-ink',
  MEDIUM: 'bg-accent text-ink border-ink',
  HIGH: 'bg-secondary text-white border-ink',
  CRITICAL: 'bg-secondary-strong text-white border-ink',
};

const TopRiskParcels: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: parcels = [], isLoading, error } = useQuery<RiskScore[]>(['top-risk-parcels'], async () => {
    const response = await apiService.get('/predictive-analytics/top-risk-parcels', { params: { limit: 10 } });
    return response.data;
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-ink/60 py-3">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        {t('topRiskParcels.loading')}
      </div>
    );
  }
  if (error) return <div className="text-sm font-medium text-ink/60 py-3">{t('topRiskParcels.error')}</div>;
  if (parcels.length === 0) return <div className="text-sm font-medium text-ink/60 py-3">{t('topRiskParcels.empty')}</div>;

  return (
    <div className="border-2 border-ink divide-y-2 divide-ink bg-surface">
      {parcels.map((parcel) => (
        <div key={parcel.parcelId} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3 text-sm">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-ink">{t('myParcels.parcelHash', { id: parcel.parcelId.substring(0, 8) })}</span>
            <span
              className={`inline-flex items-center gap-1 border-2 px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${
                RISK_BAND_CLASS[parcel.riskBand] ?? 'bg-muted text-ink border-ink'
              }`}
            >
              <ShieldAlert className="w-3 h-3" aria-hidden="true" />
              {parcel.riskBand} ({parcel.overallScore})
            </span>
          </div>
          <button
            onClick={() => navigate(`/parcels/${parcel.parcelId}`)}
            className="inline-flex items-center gap-1.5 border-2 border-ink bg-primary hover:bg-primary-strong text-white text-xs font-bold uppercase tracking-wide px-2.5 py-1.5 shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            {t('myParcels.view')}
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default TopRiskParcels;
