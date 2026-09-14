import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { Circle, Square, Triangle, ArrowRight, ShieldCheck, Award, Users } from 'lucide-react';

// Public, informational page - styled with Bhashini government design tokens
const AboutPage: React.FC = () => {
  const { t } = useTranslation();

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

      {/* Audience Roles Grid */}
      <div className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-heading)] flex items-center gap-2">
          <Users className="w-5 h-5 text-[var(--bhashini-accent)]" />
          <span>{t('about.audienceHeading')}</span>
        </h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {/* Citizen */}
          <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px] p-5 shadow-xs hover:border-[var(--bhashini-accent)] transition">
            <div className="w-9 h-9 rounded-[4px] bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-[var(--bhashini-accent)] mb-3">
              <Circle className="w-4 h-4 fill-current" aria-hidden="true" />
            </div>
            <h3 className="font-bold text-sm text-[var(--text-heading)] mb-1">{t('about.citizenTitle')}</h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">{t('about.citizenBody')}</p>
          </div>

          {/* Officer */}
          <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px] p-5 shadow-xs hover:border-[var(--bhashini-accent)] transition">
            <div className="w-9 h-9 rounded-[4px] bg-[var(--action-500)]/15 border border-[var(--action-500)]/30 flex items-center justify-center text-[var(--action-700)] mb-3">
              <Square className="w-4 h-4 fill-current" aria-hidden="true" />
            </div>
            <h3 className="font-bold text-sm text-[var(--text-heading)] mb-1">{t('about.officerTitle')}</h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">{t('about.officerBody')}</p>
          </div>

          {/* Admin */}
          <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px] p-5 shadow-xs hover:border-[var(--bhashini-accent)] transition">
            <div className="w-9 h-9 rounded-[4px] bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] mb-3">
              <Triangle className="w-4 h-4 fill-current" aria-hidden="true" />
            </div>
            <h3 className="font-bold text-sm text-[var(--text-heading)] mb-1">{t('about.adminTitle')}</h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">{t('about.adminBody')}</p>
          </div>
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
