import React from 'react';
import { Clock, CheckCircle2, ExternalLink } from 'lucide-react';
import { useTranslation } from '../../../context/LanguageContext';

interface ActivityItem {
  action: string;
  timestamp: string;
  location: string;
  device: string;
  status: 'Completed' | 'Successful' | 'Failed';
}

interface ActivityTimelineProps {
  onViewLogClick?: () => void;
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ onViewLogClick }) => {
  const { t } = useTranslation();
  const activities: ActivityItem[] = [
    { action: t('activityTimeline.event.signedIn'), timestamp: '11 Sep 2026, 10:24 AM', location: 'Pune office', device: 'Windows · Chrome', status: 'Successful' },
    { action: t('activityTimeline.event.verifiedOwnership'), timestamp: '10 Sep 2026, 04:18 PM', location: 'Pune office', device: '', status: 'Completed' },
    { action: t('activityTimeline.event.reviewedParcel'), timestamp: '10 Sep 2026, 02:32 PM', location: 'GIS workstation', device: '', status: 'Completed' },
    { action: t('activityTimeline.event.downloadedReport'), timestamp: '09 Sep 2026, 05:46 PM', location: 'Windows · Chrome', device: '', status: 'Completed' },
    { action: t('activityTimeline.event.updatedProfile'), timestamp: '08 Sep 2026, 11:15 AM', location: 'Pune office', device: '', status: 'Completed' },
    { action: t('activityTimeline.event.permissionsReviewed'), timestamp: '07 Sep 2026', location: 'Administration portal', device: '', status: 'Completed' },
  ];
  const statusLabel: Record<ActivityItem['status'], string> = {
    Completed: t('activityTimeline.status.completed'),
    Successful: t('activityTimeline.status.successful'),
    Failed: t('activityTimeline.status.failed'),
  };
  return (
    <div className="bg-surface border-2 border-ink shadow-hard-md overflow-hidden">
      <div className="border-b-2 border-ink/20 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink">{t('activityTimeline.heading')}</h3>
        </div>
        {onViewLogClick && (
          <button
            type="button"
            onClick={onViewLogClick}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
          >
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
            {t('activityTimeline.viewFullLog')}
          </button>
        )}
      </div>
      <div className="p-6">
        <div className="relative space-y-6">
          <div className="absolute left-[11px] top-3 bottom-3 w-px bg-ink/20" aria-hidden="true" />
          {activities.map((activity, index) => (
            <div key={index} className="relative flex items-start gap-4 pl-7">
              <span className="absolute left-[5px] top-2 w-3 h-3 bg-primary border-2 border-ink rounded-full" aria-hidden="true" />
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-ink">{activity.action}</p>
                  <span className={`inline-flex items-center gap-1 border-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    activity.status === 'Completed' ? 'bg-primary/15 text-primary border-primary/50' :
                    activity.status === 'Successful' ? 'bg-primary/15 text-primary border-primary/50' :
                    'bg-accent/20 text-secondary-strong border-accent/50'
                  }`}>
                    {activity.status === 'Successful' && <CheckCircle2 className="w-3 h-3" aria-hidden="true" />}
                    {statusLabel[activity.status]}
                  </span>
                </div>
                <p className="text-xs text-ink/50 mt-1">{activity.timestamp}</p>
                {(activity.location || activity.device) && (
                  <p className="text-xs text-ink/40 mt-0.5">
                    {activity.location}{activity.location && activity.device ? ' · ' : ''}{activity.device}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ActivityTimeline;