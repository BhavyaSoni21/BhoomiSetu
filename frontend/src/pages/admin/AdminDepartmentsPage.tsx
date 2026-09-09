import React from 'react';
import { Building2 } from 'lucide-react';
import DepartmentManagement from '../../features/admin/DepartmentManagement';
import CornerMarker from '../../features/admin/CornerMarker';

// Admin Portal "Departments" page (docs/FRONTEND_UPGRADE_SPEC.md §7, Phase 3).
const AdminDepartmentsPage: React.FC = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-display text-ink">Departments</h1>
      <p className="text-ink/60 mt-1">Manage the department directory shown across the platform.</p>
    </div>

    <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-6">
      <CornerMarker />
      <div className="flex items-center gap-2 mb-1">
        <Building2 className="w-5 h-5 text-primary" aria-hidden="true" />
        <h2 className="text-xl font-black uppercase tracking-tight font-display text-ink">Department Directory</h2>
      </div>
      <p className="text-sm text-ink/60 mb-4">
        Name, description, and contact info for each department - display metadata for the Admin Portal, separate
        from the department codes workflows and roles already route by.
      </p>
      <DepartmentManagement />
    </div>
  </div>
);

export default AdminDepartmentsPage;
