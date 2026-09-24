import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { ArrowRight, Award, Users, MapPin, Layers, Database, FileCheck, Eye, Target, Search, Sparkles, ListChecks, Calendar, Globe, Bell } from 'lucide-react';

const FEATURE_ICONS = [Search, Layers, FileCheck, Sparkles, ListChecks, Calendar, Globe, Bell];

// No middle names, per request. Order = leader first.
const TEAM = [
  { name: 'Purv Jain', roleKey: 'about.roles.teamLeader' },
  { name: 'Bhavya Soni', roleKey: 'about.roles.fullStack' },
  { name: 'Avadhut Gore', roleKey: 'about.roles.backend' },
  { name: 'Ashutosh Amale', roleKey: 'about.roles.frontend' },
  { name: 'Rishabh Jain', roleKey: 'about.roles.researcher' },
  { name: 'Niharika Kharche', roleKey: 'about.roles.presenter' },
];
const initials = (n: string) => n.split(' ').map((w) => w[0]).join('').toUpperCase();
import apiService from '../services/apiService';

// Public, informational page - styled with Bhashini government design tokens
const AboutPage: React.FC = () => {
  const { t } = useTranslation();

  const [stats, setStats] = useState<{ parcels: number; serviceRequests: number } | null>(null);
  useEffect(() => {
    // Public page - tolerate an offline/failed backend, just hide live numbers.
    apiService.get('/public/stats').then((r) => setStats(r.data)).catch(() => setStats(null));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
      {/* Overview Card */}
      <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px] p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2.5 py-0.5 rounded-[4px] bg-emerald-50 dark:bg-emerald-950/60 text-[var(--bhashini-accent)] text-xs font-semibold uppercase tracking-wider border border-emerald-200 dark:border-emerald-800">
            About Platform
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-heading)] mb-4">
          {t('about.heading')}
        </h1>
        <p className="text-[var(--text-primary)] leading-relaxed text-sm sm:text-base">
          {t('about.intro')}
        </p>
      </div>

      {/* Impact Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Database, value: stats ? stats.parcels.toLocaleString() : '—', label: t('about.statParcels') },
          { icon: FileCheck, value: stats ? stats.serviceRequests.toLocaleString() : '—', label: t('about.statRequests') },
          { icon: MapPin, value: '2', label: t('about.statPilots') },
          { icon: Layers, value: '6', label: t('about.statLayers') },
        ].map((s, i) => (
          <div key={i} className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px] p-5 shadow-xs text-center">
            <s.icon className="w-5 h-5 text-[var(--bhashini-accent)] mx-auto mb-2" aria-hidden="true" />
            <div className="text-2xl font-bold text-[var(--text-heading)] tabular-nums">{s.value}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Mission Card */}
      <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px] p-6 sm:p-8 shadow-xs">
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-heading)] mb-3 flex items-center gap-2">
          <Award className="w-5 h-5 text-[var(--bhashini-accent)]" />
          <span>{t('about.missionHeading')}</span>
        </h2>
        <p className="text-[var(--text-primary)] leading-relaxed text-sm sm:text-base">
          {t('about.missionBody')}
        </p>
      </div>

      {/* Pilot Deployments */}
      <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px] p-6 sm:p-8 shadow-xs">
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-heading)] mb-3 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-[var(--bhashini-accent)]" />
          <span>{t('about.pilotsHeading')}</span>
        </h2>
        <p className="text-[var(--text-primary)] leading-relaxed text-sm sm:text-base">
          {t('about.pilotsBody')}
        </p>
      </div>

      {/* Vision + Mission */}
      <div className="grid sm:grid-cols-2 gap-4">
        {[
          { icon: Eye, heading: t('about.visionHeading'), body: t('about.visionBody') },
          { icon: Target, heading: t('about.missionStatementHeading'), body: t('about.missionStatementBody') },
        ].map((c, i) => (
          <div key={i} className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px] p-6 shadow-xs">
            <h2 className="text-lg font-bold tracking-tight text-[var(--text-heading)] mb-3 flex items-center gap-2">
              <c.icon className="w-5 h-5 text-[var(--bhashini-accent)]" />
              <span>{c.heading}</span>
            </h2>
            <p className="text-[var(--text-primary)] leading-relaxed text-sm">{c.body}</p>
          </div>
        ))}
      </div>

      {/* What you can do */}
      <div className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-heading)] flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--bhashini-accent)]" />
          <span>{t('about.featuresHeading')}</span>
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {FEATURE_ICONS.map((Icon, i) => (
            <div key={i} className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px] p-5 shadow-xs flex gap-3">
              <div className="w-9 h-9 shrink-0 rounded-[4px] bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-[var(--bhashini-accent)]">
                <Icon className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[var(--text-heading)] mb-1">{t(`about.feature${i}Title`)}</h3>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">{t(`about.feature${i}Desc`)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team */}
      <div className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-heading)] flex items-center gap-2">
          <Users className="w-5 h-5 text-[var(--bhashini-accent)]" />
          <span>{t('about.teamHeading')}</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {TEAM.map((m) => (
            <div key={m.name} className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px] p-5 shadow-xs text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-[var(--bhashini-accent)] font-bold text-sm mb-3">
                {initials(m.name)}
              </div>
              <div className="font-bold text-sm text-[var(--text-heading)]">{m.name}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">{t(m.roleKey)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="pt-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-[4px] bg-[var(--bhashini-accent)] hover:bg-[var(--brand-700)] px-5 py-2.5 text-xs sm:text-sm font-medium text-white transition shadow-xs"
        >
          <span>{t('about.cta')}</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
};

export default AboutPage;
