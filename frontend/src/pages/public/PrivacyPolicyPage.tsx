import React from 'react';
import { ShieldCheck, Lock, Eye, FileText, CheckCircle2 } from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="bg-[var(--surface-1)] p-6 sm:p-8 rounded-2xl border border-[var(--border)] shadow-sm space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          <span>GIGW 3.0 Compliant Data Privacy</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-heading)]">
          Privacy Policy & Data Protection
        </h1>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-3xl font-medium">
          BhoomiSetu is committed to protecting the privacy, security, and integrity of parcel owner data and government land records in accordance with Indian IT Laws and Digital Personal Data Protection (DPDP) Act guidelines.
        </p>
      </div>

      {/* Sections */}
      <div className="bg-[var(--surface-1)] p-6 sm:p-8 rounded-2xl border border-[var(--border)] shadow-sm space-y-6 text-sm text-[var(--text-primary)]">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--text-heading)] flex items-center gap-2">
            <Lock className="w-5 h-5 text-[var(--bhashini-accent)]" />
            1. Information Collection & Usage
          </h2>
          <p className="text-[var(--text-secondary)] leading-relaxed">
            BhoomiSetu processes official parcel identifiers (ULPIN, survey numbers, plot boundaries) provided by state land departments. Citizen personal identification data is encrypted and accessed exclusively for verified service requests and official record queries.
          </p>
        </section>

        <section className="space-y-2 pt-4 border-t border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--text-heading)] flex items-center gap-2">
            <Eye className="w-5 h-5 text-[var(--bhashini-accent)]" />
            2. Audit Trails & Role-Gated Access
          </h2>
          <p className="text-[var(--text-secondary)] leading-relaxed">
            Every query, document upload, and request status modification on BhoomiSetu is immutably logged with digital timestamps and officer role identifiers to ensure absolute transparency and prevent unauthorized record access.
          </p>
        </section>

        <section className="space-y-2 pt-4 border-t border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--text-heading)] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[var(--bhashini-accent)]" />
            3. AI & Document Privacy
          </h2>
          <p className="text-[var(--text-secondary)] leading-relaxed">
            Uploaded land document photos processed by our OCR and AI features are evaluated strictly in transient memory. Uploaded media is never used to train public machine learning models, ensuring complete confidentiality.
          </p>
        </section>

        <div className="pt-4 flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Last Updated: September 2026 · Government of India Digital Land Governance Initiative</span>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
