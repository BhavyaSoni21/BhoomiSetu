import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2, Building2, HelpCircle } from 'lucide-react';

export const ContactUsPage: React.FC = () => {
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
          <span>National Helpdesk & Technical Support</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-heading)]">
          Contact Us & Citizen Support
        </h1>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-3xl font-medium">
          Have a question about parcel verification, ULPIN lookup, service requests, or GIS layer access? Our dedicated support team is available 24/7.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Contact Info Cards (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[var(--surface-1)] p-6 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
            <h3 className="font-bold text-base text-[var(--text-heading)] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[var(--bhashini-accent)]" />
              Central Headquarters
            </h3>

            <div className="space-y-3 text-xs text-[var(--text-primary)]">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[var(--action-700)] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="block text-[var(--text-heading)]">Digital India BhoomiSetu Division</strong>
                  <span className="text-[var(--text-secondary)] block">
                    Electronics Niketan, 6-CGO Complex, Lodhi Road, New Delhi - 110003
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-2 border-t border-[var(--border)]">
                <Phone className="w-4 h-4 text-[var(--action-700)] shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-[var(--text-heading)]">Toll-Free Citizen Helpline</strong>
                  <span className="font-mono text-sm font-bold text-[var(--bhashini-accent)] block">1800-11-2026</span>
                  <span className="text-[11px] text-[var(--text-muted)]">Monday to Saturday: 9:00 AM – 7:00 PM IST</span>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-2 border-t border-[var(--border)]">
                <Mail className="w-4 h-4 text-[var(--action-700)] shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-[var(--text-heading)]">Official Email Support</strong>
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
              Send Us a Message
            </h3>

            {submitted ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-6 rounded-xl border border-emerald-200 dark:border-emerald-900 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <h4 className="font-bold text-base text-[var(--text-heading)]">Message Sent Successfully</h4>
                <p className="text-xs text-[var(--text-secondary)]">
                  Thank you for reaching out. Ticket ID <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">#BST-2026-8492</span> has been created. Our helpdesk team will respond within 24 hours.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-3 px-4 py-1.5 rounded-lg bg-[var(--bhashini-accent)] text-white text-xs font-bold"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-[var(--text-heading)] mb-1">Your Full Name *</label>
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
                    <label className="block font-bold text-[var(--text-heading)] mb-1">Email Address *</label>
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
                  <label className="block font-bold text-[var(--text-heading)] mb-1">Subject / Query Category</label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-heading)] focus:outline-none focus:border-[var(--bhashini-accent)]"
                  >
                    <option value="">General Inquiry</option>
                    <option value="ULPIN Lookup">ULPIN / Survey Number Verification</option>
                    <option value="Citizen Request">Citizen Service Request Query</option>
                    <option value="Officer Support">Officer Portal Access & Role Approval</option>
                    <option value="Technical Issue">Report Technical Issue</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-heading)] mb-1">Your Message *</label>
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
                  <span>Submit Message to Helpdesk</span>
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
