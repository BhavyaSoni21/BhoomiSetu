import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2, Building2, HelpCircle } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

export const ContactUsPage: React.FC = () => {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.email && formData.message) {
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="bg-[var(--surface-1)] p-6 sm:p-8 rounded-2xl border border-[var(--border)] shadow-sm space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
          <HelpCircle className="w-4 h-4" />
          <span>{t('contactUsPage.helpdeskBadge')}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-heading)]">
          {t('contactUsPage.heading')}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-3xl font-medium">
          {t('contactUsPage.intro')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Contact Info Cards (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[var(--surface-1)] p-6 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
            <h3 className="font-bold text-base text-[var(--text-heading)] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[var(--bhashini-accent)]" />
              {t('contactUsPage.headquarters')}
            </h3>

            <div className="space-y-3 text-xs text-[var(--text-primary)]">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[var(--action-700)] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="block text-[var(--text-heading)]">{t('contactUsPage.divisionName')}</strong>
                  <span className="text-[var(--text-secondary)] block">
                    {t('contactUsPage.address')}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-2 border-t border-[var(--border)]">
                <Phone className="w-4 h-4 text-[var(--action-700)] shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-[var(--text-heading)]">{t('contactUsPage.helpline')}</strong>
                  <span className="font-mono text-sm font-bold text-[var(--bhashini-accent)] block">1800-11-2026</span>
                  <span className="text-[11px] text-[var(--text-muted)]">{t('contactUsPage.helplineHours')}</span>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-2 border-t border-[var(--border)]">
                <Mail className="w-4 h-4 text-[var(--action-700)] shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-[var(--text-heading)]">{t('contactUsPage.emailSupport')}</strong>
                  <span className="font-mono text-xs text-[var(--text-heading)] block">helpdesk@bhoomisetu.gov.in</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form (7 cols) */}
        <div className="lg:col-span-7">
          <div className="bg-[var(--surface-1)] p-6 sm:p-8 rounded-2xl border border-[var(--border)] shadow-sm">
            <h3 className="font-bold text-lg text-[var(--text-heading)] mb-4">
              {t('contactUsPage.formHeading')}
            </h3>

            {submitted ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-6 rounded-xl border border-emerald-200 dark:border-emerald-900 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <h4 className="font-bold text-base text-[var(--text-heading)]">{t('contactUsPage.submittedHeading')}</h4>
                <p className="text-xs text-[var(--text-secondary)]">
                  {t('contactUsPage.submittedBody', { ticketId: '#BST-2026-8492' })}
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-3 px-4 py-1.5 rounded-lg bg-[var(--bhashini-accent)] text-white text-xs font-bold"
                >
                  {t('contactUsPage.sendAnother')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-[var(--text-heading)] mb-1">{t('contactUsPage.fullName')}</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-heading)] focus:outline-none focus:border-[var(--bhashini-accent)]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[var(--text-heading)] mb-1">{t('contactUsPage.emailAddress')}</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. rahul@example.com"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-heading)] focus:outline-none focus:border-[var(--bhashini-accent)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-heading)] mb-1">{t('contactUsPage.subject')}</label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-heading)] focus:outline-none focus:border-[var(--bhashini-accent)]"
                  >
                    <option value="">{t('contactUsPage.subjectGeneral')}</option>
                    <option value="ULPIN Lookup">{t('contactUsPage.subjectUlpin')}</option>
                    <option value="Citizen Request">{t('contactUsPage.subjectCitizenRequest')}</option>
                    <option value="Officer Support">{t('contactUsPage.subjectOfficerSupport')}</option>
                    <option value="Technical Issue">{t('contactUsPage.subjectTechnicalIssue')}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-heading)] mb-1">{t('contactUsPage.message')}</label>
                  <textarea
                    rows={4}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Describe your inquiry or parcel detail here..."
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-heading)] focus:outline-none focus:border-[var(--bhashini-accent)] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-[var(--bhashini-accent)] hover:bg-[var(--brand-700)] text-white font-bold text-sm tracking-wide transition shadow-sm flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{t('contactUsPage.submitButton')}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactUsPage;
