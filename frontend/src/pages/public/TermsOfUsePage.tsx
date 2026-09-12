import React from 'react';
import { Scale, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

export const TermsOfUsePage: React.FC = () => {
  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="bg-[var(--surface-1)] p-6 sm:p-8 rounded-2xl border border-[var(--border)] shadow-sm space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
          <Scale className="w-4 h-4" />
          <span>Terms of Use & Legal Standards</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-heading)]">
          Terms of Use & Platform Governance
        </h1>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-3xl font-medium">
          Terms and conditions governing citizen access, official land record inspection, service request submission, and certified surveyor interactions on the BhoomiSetu platform.
        </p>
      </div>

      {/* Sections */}
      <div className="bg-[var(--surface-1)] p-6 sm:p-8 rounded-2xl border border-[var(--border)] shadow-sm space-y-6 text-sm text-[var(--text-primary)]">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--text-heading)] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[var(--action-700)]" />
            1. Authoritative Nature of Records
          </h2>
          <p className="text-[var(--text-secondary)] leading-relaxed">
            BhoomiSetu aggregates authoritative department feeds across Revenue, Registration, Planning, Taxation, Disputes, and Encumbrances. Official actions (mutations, legal certifications, and dispute adjudications) remain role-gated to verified government officers.
          </p>
        </section>

        <section className="space-y-2 pt-4 border-t border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--text-heading)] flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[var(--action-700)]" />
            2. Citizen Account Responsibilities
          </h2>
          <p className="text-[var(--text-secondary)] leading-relaxed">
            Citizens registering on BhoomiSetu must provide valid contact credentials and link parcels legitimately owned or authorized. Providing fraudulent documents or false claims is strictly prohibited under Indian Revenue and Penal Laws.
          </p>
        </section>

        <section className="space-y-2 pt-4 border-t border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--text-heading)] flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-[var(--action-700)]" />
            3. Deterministic Governance & AI Role
          </h2>
          <p className="text-[var(--text-secondary)] leading-relaxed">
            Artificial Intelligence (Groq assistant & OCR verification) provides guidance and document pre-checking support only. Final legal decisions, approval of mutations, and land boundary confirmations are 100% deterministic and officer-audited.
          </p>
        </section>

        <div className="pt-4 flex items-center gap-2 text-xs font-bold text-[var(--action-700)] bg-[var(--surface-2)] p-4 rounded-xl border border-[var(--border)]">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>BhoomiSetu Platform Standard · Ministry of Panchayati Raj / Digital India Framework</span>
        </div>
      </div>
    </div>
  );
};

export default TermsOfUsePage;
