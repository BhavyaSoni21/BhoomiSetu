import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import ComingSoonCard from '../../features/citizen/ComingSoonCard';

// A per-department notification feed (received/under review/department
// approved/department rejected/info requested/fully approved/fully
// rejected) - docs/FRONTEND_UPGRADE_SPEC.md §4. The Requests page (built
// this pass) already surfaces per-department step status on each request;
// this is the distinct, not-yet-built structured feed on top of it.
const NotificationsPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl">
      <ComingSoonCard
        icon={Bell}
        title={t('placeholders.notificationsTitle')}
        description={t('placeholders.notificationsDesc')}
        accentClass="bg-accent"
      />
    </div>
  );
};

export default NotificationsPage;
