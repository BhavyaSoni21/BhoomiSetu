import React from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { Building2 } from 'lucide-react';
import DepartmentManagement from '../../features/admin/DepartmentManagement';
import CornerMarker from '../../features/admin/CornerMarker';
import BackButton from '../../components/BackButton';

// Admin Portal "Departments" page (docs/FRONTEND_UPGRADE_SPEC.md §7, Phase 3).
const AdminDepartmentsPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <BackButton variant="ink" />
      <div>
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-display text-ink">{t('adminNav.departments')}</h1>
        <p className="text-ink/60 mt-1">{t('adminPortal.departmentsSubtitle')}</p>
      </div>

      <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-6">
        <CornerMarker />
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-5 h-5 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-black uppercase tracking-tight font-display text-ink">{t('adminPortal.departmentDirectoryHeading')}</h2>
        </div>
        <p className="text-sm text-ink/60 mb-4">
          {t('adminPortal.departmentDirectoryDesc')}
        </p>
        <DepartmentManagement />
      </div>
    </div>
  );
};

export default AdminDepartmentsPage;
