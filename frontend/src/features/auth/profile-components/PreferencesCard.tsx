import React from 'react';
import { ExternalLink } from 'lucide-react';
import { ProfileField } from './ProfileField';
import { useTranslation } from '../../../context/LanguageContext';

interface PreferencesCardProps {
  onViewAccessMatrixClick?: () => void;
}

const PreferencesCard: React.FC<PreferencesCardProps> = ({ onViewAccessMatrixClick }) => {
  const { t } = useTranslation();
  return (
    <div className="bg-surface border-2 border-ink shadow-hard-md overflow-hidden">
      <div className="border-b-2 border-ink/20 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ExternalLink className="w-5 h-5 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink">{t('preferencesCard.heading')}</h3>
        </div>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50 mb-3">{t('preferencesCard.basicPreferences')}</h4>
            <ProfileField label={t('preferencesCard.preferredLanguage')} value="English" />
            <ProfileField label={t('preferencesCard.regionalLanguage')} value="Marathi" />
            <ProfileField label={t('preferencesCard.dateFormat')} value="DD MMM YYYY" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50 mb-3">{t('preferencesCard.mapDisplayPreferences')}</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>{t('preferencesCard.defaultMapLayer')}</span>
                <span className="text-ink font-medium">{t('preferencesCard.cadastralParcels')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t('preferencesCard.mapTheme')}</span>
                <span className="text-ink font-medium">{t('preferencesCard.standard')}</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50 mb-3">{t('preferencesCard.accessibilityText')}</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>{t('preferencesCard.highContrastMode')}</span>
                <span className="text-ink font-medium">{t('preferencesCard.off')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t('preferencesCard.textSizePreference')}</span>
                <span className="text-ink font-medium">{t('preferencesCard.medium')}</span>
              </div>
            </div>
          </div>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50 mb-3">{t('preferencesCard.systemIntegration')}</h4>
          <div className="space-y-3">
            {onViewAccessMatrixClick && (
              <button
                type="button"
                onClick={onViewAccessMatrixClick}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
              >
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
                {t('preferencesCard.viewAccessMatrix')}
              </button>
            )}
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{t('preferencesCard.notificationPreferences')}</dt>
              <dd className="text-sm text-ink font-medium">{t('preferencesCard.configuredPerSection')}</dd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreferencesCard;