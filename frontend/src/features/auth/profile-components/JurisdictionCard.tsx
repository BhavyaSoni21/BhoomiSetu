import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, ExternalLink } from 'lucide-react';
import GISMapPreview from './GISMapPreview';
import { ProfileField } from './ProfileField';
import { useTranslation } from '../../../context/LanguageContext';

interface JurisdictionCardProps {
  onViewMapClick?: () => void;
}

const JurisdictionCard: React.FC<JurisdictionCardProps> = ({ onViewMapClick }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const handleMapClick = onViewMapClick || (() => navigate('/officer/map'));

  return (
    <div className="bg-surface border-2 border-ink shadow-hard-md overflow-hidden">
      <div className="border-b-2 border-ink/20 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Map className="w-5 h-5 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink">{t('jurisdictionCard.heading')}</h3>
        </div>
        <button
          type="button"
          onClick={handleMapClick}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
        >
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
          {t('jurisdictionCard.viewOnMap')}
        </button>
      </div>
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Map className="w-4 h-4 text-primary" aria-hidden="true" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50">{t('jurisdictionCard.jurisdictionDetails')}</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ProfileField label={t('jurisdictionCard.state')} value="Maharashtra" />
            <ProfileField label={t('jurisdictionCard.district')} value="Pune" />
            <ProfileField label={t('jurisdictionCard.talukaSubdivision')} value="Haveli" />
            <ProfileField label={t('jurisdictionCard.assignedVillages')} value="12 villages" />
            <ProfileField label={t('jurisdictionCard.assignedSurveyZones')} value="Zone A, B, C" />
            <ProfileField label={t('jurisdictionCard.responsibleDepartment')} value="Land Records" />
          </div>
          <div className="mt-4">
            <ProfileField label={t('jurisdictionCard.currentRoleScope')} value="Record verification, Mutation approval, Survey coordination" />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{t('jurisdictionCard.assignedRequests')}</dt>
              <dd className="text-2xl font-black text-ink">24</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{t('jurisdictionCard.pendingVerifications')}</dt>
              <dd className="text-2xl font-black text-ink">7</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{t('jurisdictionCard.completedReviews')}</dt>
              <dd className="text-2xl font-black text-ink">128</dd>
            </div>
          </div>
          <div className="mt-4">
            <ProfileField label={t('jurisdictionCard.lastJurisdictionSync')} value="10 Sep 2026, 08:15 PM" />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <GISMapPreview
            district="Pune"
            taluka="Haveli"
            assignedVillages={12}
            zones={['Zone A', 'Zone B', 'Zone C']}
          />
          <button
            type="button"
            onClick={handleMapClick}
            className="w-full inline-flex items-center justify-center gap-2 border-2 border-ink bg-primary text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
            {t('jurisdictionCard.viewOnMap')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JurisdictionCard;