import React from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { Users, BarChart3, ShieldAlert, ShieldCheck, Activity, Database, Server } from 'lucide-react';
import AnalyticsDashboard from '../../features/analytics/AnalyticsDashboard';
import TopRiskParcels from '../../features/analytics/TopRiskParcels';
import UserManagement from '../../features/admin/UserManagement';
import { useAuthUser } from '../../features/auth/auth';

const AdminDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { data: user } = useAuthUser();
  if (!user) return null;

  return (
    <div className="space-y-8 animate-fade-up max-w-7xl">
      {/* ── Admin Command Header ── */}
      <div
        className="rounded-2xl p-6 sm:p-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, var(--brand-900) 0%, var(--brand-700) 100%)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 8px 30px rgba(var(--color-ink), 0.12)',
        }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold"
                style={{ background: 'rgba(var(--action-500), 0.2)', color: 'var(--action-500)', border: '1px solid rgba(var(--action-500), 0.4)' }}
              >
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                SYSTEM ADMINISTRATOR · ROOT CONSOLE
              </span>
              <span className="text-white/40 text-xs hidden sm:inline">|</span>
              <span className="text-white/80 text-xs font-mono">
                PostgreSQL + PostGIS Live
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-heading font-bold text-white tracking-tight">
              State Land Governance Administration
            </h1>
            <span className="sr-only">Welcome, {user.name}</span>
            <p className="text-white/80 text-sm sm:text-base max-w-2xl leading-relaxed">
              Global system control plane. Monitor inter-departmental workflows, manage user authorizations, analyze revenue risk, and oversee cadastral map layers.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-center">
            <span className="px-3.5 py-2 rounded-xl text-xs font-mono font-bold bg-white/10 text-white border border-white/20">
              Uptime: 99.98%
            </span>
          </div>
        </div>
      </div>

      {/* ── User & Officer Management Section ── */}
      <div className="gov-card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gov-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-900/10 text-brand-900 flex items-center justify-center">
              <Users className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-heading font-bold text-text-heading">
                {t('adminPortal.userManagementHeading', 'User & Department Officer Management')}
              </h2>
              <p className="text-xs text-text-secondary">
                {t('adminPortal.userManagementDesc', 'Provision officer roles, manage citizen access, and configure departmental jurisdictions.')}
              </p>
            </div>
          </div>
        </div>
        <UserManagement />
      </div>

      {/* ── Governance Analytics Dashboard ── */}
      <div className="gov-card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gov-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-900/10 text-brand-900 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-heading font-bold text-text-heading">
                {t('adminPortal.governanceAnalyticsHeading', 'State Land Analytics & Interoperability')}
              </h2>
              <p className="text-xs text-text-secondary">
                Real-time metrics across 7 participating departments and SVAMITVA clusters.
              </p>
            </div>
          </div>
        </div>
        <AnalyticsDashboard />
      </div>

      {/* ── High Risk Parcels & Enforcement ── */}
      <div className="gov-card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gov-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-red-100 text-gov-error flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-heading font-bold text-text-heading">
                {t('adminPortal.topRiskParcelsHeading', 'High-Risk Cadastral Parcels')}
              </h2>
              <p className="text-xs text-text-secondary">
                {t('adminPortal.topRiskParcelsDesc', 'Parcels flagged with active litigation stays, multi-party dispute filings, or environmental restrictions.')}
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-red-100 text-red-800">
            Automated Audit
          </span>
        </div>
        <TopRiskParcels />
      </div>
    </div>
  );
};

export default AdminDashboardPage;
