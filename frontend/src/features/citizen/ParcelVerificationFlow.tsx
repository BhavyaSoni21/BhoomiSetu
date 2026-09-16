import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../context/LanguageContext';
import {
  Upload,
  FileText,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
  Sparkles,
  MapPin,
  Check,
  X,
  FileCheck,
  Building,
} from 'lucide-react';
import apiService from '../../services/apiService';
import { VerificationResult, ParcelSummary } from '../../types/parcel';
import { useNavigate } from 'react-router-dom';

interface ParcelVerificationFlowProps {
  onSuccess?: (parcel: ParcelSummary) => void;
  onCancel?: () => void;
}

export const ParcelVerificationFlow: React.FC<ParcelVerificationFlowProps> = ({ onSuccess, onCancel }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [formFields, setFormFields] = useState({
    khate_kramank: '',
    owner_name: '',
    survey_number: '',
    village: '',
    taluka: '',
    district: 'Ahmadnagar',
    mobile: '',
    ulpin: '',
  });

  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  const verifyMutation = useMutation<VerificationResult, Error, void>(async () => {
    if (!file) throw new Error('Please select a document file');
    const formData = new FormData();
    formData.append('document', file);
    formData.append('khate_kramank', formFields.khate_kramank);
    formData.append('owner_name', formFields.owner_name);
    formData.append('survey_number', formFields.survey_number);
    formData.append('village', formFields.village);
    formData.append('taluka', formFields.taluka);
    formData.append('district', formFields.district);
    formData.append('mobile', formFields.mobile);
    if (formFields.ulpin) formData.append('ulpin', formFields.ulpin);

    const response = await apiService.post('/parcels/verify', formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data;
  }, {
    onSuccess: (data) => {
      setVerificationResult(data);
      queryClient.invalidateQueries(['my-parcels']);
      queryClient.invalidateQueries(['my-workflows']);
      if (data.verdict === 'VERIFIED' && data.parcel) {
        onSuccess?.(data.parcel);
      }
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormFields((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setVerificationResult(null);
    verifyMutation.reset();
  };

  const fillDemoData = () => {
    setFormFields({
      khate_kramank: '1425',
      owner_name: 'Ashutosh Ramesh Amale',
      survey_number: '588/2',
      village: 'Shedgaon',
      taluka: 'Sangamner',
      district: 'Ahmadnagar',
      mobile: '9867180509',
      ulpin: 'MH2026091600125',
    });
  };

  const isFormValid =
    !!file &&
    formFields.khate_kramank.trim() !== '' &&
    formFields.survey_number.trim() !== '' &&
    formFields.owner_name.trim() !== '' &&
    formFields.village.trim() !== '' &&
    formFields.district.trim() !== '';

  return (
    <div className="gov-card bg-white dark:bg-[#0D261D] border border-gov-border rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden animate-fade-up">
      {/* Header */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-brand-900 via-brand-800 to-brand-700 text-white flex items-center justify-between border-b border-white/10 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/25 shadow-xs">
            <FileCheck className="w-5 h-5 text-action-500" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-heading font-bold text-white tracking-tight">
              {t('parcelVerification.heading', 'New Property Ownership Claim')}
            </h2>
            <p className="text-xs text-white/85 mt-0.5">
              {t('parcelVerification.subheading', 'Upload 7/12 or RoR document and verify parcel details')}
            </p>
          </div>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-heading font-semibold px-3.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/25 transition shadow-xs"
          >
            {t('common.cancel', 'Cancel')}
          </button>
        )}
      </div>

      <div className="p-6 sm:p-8 space-y-6 bg-white dark:bg-[#0D261D]">
        {/* Verification Result View */}
        {verificationResult ? (
          <div className="space-y-6 animate-fade-up">
            {/* Verdict Banners */}
            {verificationResult.verdict === 'VERIFIED' && (
              <div className="p-5 rounded-xl bg-green-50/90 dark:bg-green-950/40 border border-green-300 dark:border-green-800 text-green-950 dark:text-green-200 space-y-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                  <div>
                    <h3 className="font-heading font-bold text-base">
                      {t('parcelVerification.verifiedTitle', 'Parcel Linked & Verified Successfully!')}
                    </h3>
                    <p className="text-xs text-green-800 dark:text-green-300 mt-0.5">
                      {t('parcelVerification.verifiedDesc', 'Your land ownership details matched the official document. This parcel is now active on your profile.')}
                    </p>
                  </div>
                </div>

                <div className="mt-4 p-4 rounded-lg bg-white dark:bg-surface-2 border border-green-200 dark:border-green-800/50 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="inline-block px-2.5 py-1 rounded text-xs font-mono font-bold bg-green-100 text-green-900 border border-green-300 mb-1.5">
                      Local ID: {verificationResult.localId}
                    </span>
                    <p className="text-xs text-text-secondary font-medium">
                      Survey: <strong className="text-text-heading">{formFields.survey_number}</strong> · Khate: <strong className="text-text-heading">{formFields.khate_kramank}</strong> · {formFields.village}, {formFields.district}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('/citizen/raise-request')}
                      className="px-4 py-2 rounded-xl bg-brand-900 hover:bg-brand-700 text-white text-xs font-bold font-heading inline-flex items-center gap-1.5 transition shadow-xs"
                    >
                      <span>{t('parcelVerification.raiseComplaintCta', 'Raise Complaint on this Parcel')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    {onCancel && (
                      <button
                        type="button"
                        onClick={onCancel}
                        className="px-3.5 py-2 rounded-xl border border-gov-border text-xs font-semibold hover:bg-surface-2 transition"
                      >
                        {t('parcelVerification.viewInMyParcels', 'View My Parcels')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {verificationResult.verdict === 'PARTIAL MATCH' && (
              <div className="p-5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 space-y-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                  <div>
                    <h3 className="font-heading font-bold text-base">
                      {t('parcelVerification.partialTitle', 'Sent for Officer Review (Partial Match)')}
                    </h3>
                    <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                      {t('parcelVerification.partialDesc', 'Some details did not fully match the document scan (Match Score: {{score}}%). This parcel is listed as "Pending Verification" on your profile while a Land Records officer reviews it.', { score: verificationResult.matchPercent })}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-amber-100/70 dark:bg-amber-900/30 text-xs font-mono font-semibold text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  Parcel Identifier: {verificationResult.localId} &middot; Status: Pending Verification
                </div>
              </div>
            )}

            {verificationResult.verdict === 'MISMATCH' && (
              <div className="p-5 rounded-xl bg-red-50/90 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-950 dark:text-red-200 space-y-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <XCircle className="w-6 h-6 text-red-600 shrink-0" />
                  <div>
                    <h3 className="font-heading font-bold text-base">
                      {t('parcelVerification.mismatchTitle', 'Details Do Not Match Document')}
                    </h3>
                    <p className="text-xs text-red-800 dark:text-red-300 mt-0.5">
                      {t('parcelVerification.mismatchDesc', 'The information you typed does not match the uploaded document scan. Please review the comparison below, correct any errors, and try again.')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {verificationResult.verdict === 'FAKE-LIKELY' && (
              <div className="p-5 rounded-xl bg-red-50/90 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-950 dark:text-red-200 space-y-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-6 h-6 text-red-600 shrink-0" />
                  <div>
                    <h3 className="font-heading font-bold text-base">
                      {t('parcelVerification.fakeLikelyTitle', 'Document Could Not Be Verified')}
                    </h3>
                    <p className="text-xs text-red-800 dark:text-red-300 mt-0.5">
                      {t('parcelVerification.fakeLikelyDesc', 'The uploaded scan has low resolution or possible image tampering artifacts. Please upload a clear original copy or visit your Taluka Land Records office.')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Field Comparison Table */}
            {verificationResult.fieldResults && verificationResult.fieldResults.length > 0 && (
              <div className="rounded-xl border border-gov-border overflow-hidden bg-white dark:bg-[#0D261D] shadow-xs">
                <div className="px-4 py-3 bg-surface-2 border-b border-gov-border flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-text-secondary">
                    {t('parcelVerification.comparisonTitle', 'Field-by-Field Verification Report')}
                  </span>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-brand-900/10 text-brand-900">
                    Match: {verificationResult.matchedCount} / {verificationResult.totalFields} ({verificationResult.matchPercent}%)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gov-border bg-surface-2/40 text-text-muted font-mono uppercase text-[10px]">
                        <th className="py-2.5 px-4 font-semibold">{t('parcelVerification.colField', 'Field')}</th>
                        <th className="py-2.5 px-4 font-semibold">{t('parcelVerification.colTyped', 'You Typed')}</th>
                        <th className="py-2.5 px-4 font-semibold">{t('parcelVerification.colDocument', 'Document Found')}</th>
                        <th className="py-2.5 px-4 font-semibold text-center">{t('parcelVerification.colStatus', 'Status')}</th>
                        <th className="py-2.5 px-4 font-semibold text-right">{t('parcelVerification.colScore', 'Score')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gov-border">
                      {verificationResult.fieldResults.map((r) => (
                        <tr key={r.field} className="hover:bg-surface-2/30 transition">
                          <td className="py-3 px-4 font-medium text-text-heading capitalize">
                            {r.label || r.field.replace(/_/g, ' ')}
                          </td>
                          <td className="py-3 px-4 font-mono text-text-primary font-semibold">
                            {r.user || '—'}
                          </td>
                          <td className="py-3 px-4 font-mono text-text-secondary">
                            {r.doc || '—'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                                r.match
                                  ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                              }`}
                            >
                              {r.match ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                              {r.match ? 'MATCH' : 'MISMATCH'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-text-secondary">
                            {(r.score * 100).toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions for Retry / Continue */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gov-border">
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gov-border text-xs font-heading font-bold text-text-heading bg-white dark:bg-surface-2 hover:bg-surface-2 transition shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('parcelVerification.retryCta', 'Edit Details & Try Again')}</span>
              </button>

              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-6 py-2.5 rounded-xl bg-brand-900 hover:bg-brand-700 text-white text-xs font-heading font-bold uppercase tracking-wider shadow-sm transition hover:shadow-md"
                >
                  {t('parcelVerification.doneCta', 'Done / View My Parcels')}
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Form View */
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyMutation.mutate();
            }}
            className="space-y-6"
          >
            {/* Part 1: Document Upload Dropzone */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-text-heading dark:text-brand-300 mb-2.5">
                1. {t('parcelVerification.uploadLabel', 'Upload Your Land Document (7/12, RoR, Sale Deed)')}
              </label>

              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-brand-700 bg-brand-50/50 dark:bg-brand-950/20'
                    : file
                    ? 'border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20'
                    : 'border-gov-border hover:border-brand-700 bg-surface-2/40 hover:bg-brand-50/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-heading font-bold text-text-heading">{file.name}</p>
                      <p className="text-[11px] font-mono text-text-muted">
                        {(file.size / 1024).toFixed(1)} KB &middot; {file.type || 'Document'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="ml-4 p-1 rounded-full text-text-muted hover:text-red-600 hover:bg-surface-2 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-12 h-12 mx-auto rounded-full bg-brand-900/10 text-brand-900 flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-heading font-bold text-text-heading">
                        {t('parcelVerification.dropPrompt', 'Drag & drop document scan here, or click to browse')}
                      </p>
                      <p className="text-[11px] text-text-secondary mt-0.5">
                        {t('parcelVerification.supportedFormats', 'Supports PDF, JPG, PNG, WEBP (up to 10MB)')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 mt-2 px-1">
                <p className="text-[11px] text-text-muted">
                  Tip: Use a PDF with digital text layer for instantaneous 100% OCR matching.
                </p>
                <a
                  href="/sample_verified_712.pdf"
                  download="sample_verified_712.pdf"
                  className="text-[11px] font-mono font-bold text-brand-900 dark:text-brand-300 hover:text-action-600 inline-flex items-center gap-1 bg-surface-2 px-2 py-0.5 rounded border border-gov-border hover:border-brand-700 transition"
                  title="Download verified demo 7/12 document"
                >
                  <FileText className="w-3 h-3 text-action-600" />
                  <span>Download Sample 7/12 PDF</span>
                </a>
              </div>
            </div>

            {/* Part 2: Typed Fields */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-text-heading dark:text-brand-300">
                  2. {t('parcelVerification.typedDetailsLabel', 'Enter Land Holding Details to Match')}
                </label>
                <button
                  type="button"
                  onClick={fillDemoData}
                  className="text-xs font-mono font-bold text-brand-900 dark:text-brand-300 hover:text-action-600 dark:hover:text-action-400 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 transition"
                  title="Auto-fill with sample 7/12 land record values"
                >
                  <Sparkles className="w-3.5 h-3.5 text-action-600" />
                  <span>Auto-fill Sample Values</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                    {t('parcelVerification.khateLabel', 'Khate Kramank (खाते क्र.)')} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1425"
                    value={formFields.khate_kramank}
                    onChange={(e) => handleInputChange('khate_kramank', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gov-border bg-white dark:bg-[#123126] text-xs sm:text-sm font-mono text-text-heading placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                    {t('parcelVerification.ownerLabel', 'Owner / Khatedar Name')} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ashutosh Ramesh Amale"
                    value={formFields.owner_name}
                    onChange={(e) => handleInputChange('owner_name', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gov-border bg-white dark:bg-[#123126] text-xs sm:text-sm text-text-heading placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                    {t('parcelVerification.surveyLabel', 'Survey / Gat No. (सर्व्हे नं.)')} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 588/2 or 102"
                    value={formFields.survey_number}
                    onChange={(e) => handleInputChange('survey_number', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gov-border bg-white dark:bg-[#123126] text-xs sm:text-sm font-mono text-text-heading placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                    {t('parcelVerification.villageLabel', 'Village (गाव)')} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shedgaon"
                    value={formFields.village}
                    onChange={(e) => handleInputChange('village', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gov-border bg-white dark:bg-[#123126] text-xs sm:text-sm text-text-heading placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                    {t('parcelVerification.talukaLabel', 'Taluka (तालुका)')}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sangamner"
                    value={formFields.taluka}
                    onChange={(e) => handleInputChange('taluka', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gov-border bg-white dark:bg-[#123126] text-xs sm:text-sm text-text-heading placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                    {t('parcelVerification.districtLabel', 'District (जिल्हा)')} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ahmadnagar"
                    value={formFields.district}
                    onChange={(e) => handleInputChange('district', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gov-border bg-white dark:bg-[#123126] text-xs sm:text-sm text-text-heading placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                    {t('parcelVerification.mobileLabel', 'Mobile Number')}
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={formFields.mobile}
                    onChange={(e) => handleInputChange('mobile', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gov-border bg-white dark:bg-[#123126] text-xs sm:text-sm font-mono text-text-heading placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                    {t('parcelVerification.ulpinLabel', 'ULPIN (Optional)')}
                  </label>
                  <input
                    type="text"
                    placeholder="11-14 digits if known"
                    value={formFields.ulpin}
                    onChange={(e) => handleInputChange('ulpin', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gov-border bg-white dark:bg-[#123126] text-xs sm:text-sm font-mono text-text-heading placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {verifyMutation.isError && (
              <div className="p-3.5 rounded-xl bg-red-50/90 dark:bg-red-950/40 border border-red-300 text-red-800 dark:text-red-300 text-xs flex items-center gap-2 shadow-2xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{verifyMutation.error?.message || 'Verification failed. Please try again.'}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2 flex items-center justify-end gap-3">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2.5 rounded-xl border border-gov-border text-xs font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-heading transition"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              )}
              <button
                type="submit"
                disabled={!isFormValid || verifyMutation.isLoading}
                className="px-6 py-2.5 rounded-xl bg-brand-900 hover:bg-brand-700 text-white font-heading font-bold text-xs uppercase tracking-wider inline-flex items-center gap-2 shadow-sm transition hover:shadow-md disabled:opacity-50 active:scale-98"
              >
                <Search className="w-4 h-4" />
                <span>
                  {verifyMutation.isLoading
                    ? t('parcelVerification.verifyingButton', 'Running Verification Pipeline...')
                    : t('parcelVerification.findMyParcelButton', 'Find My Parcel')}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ParcelVerificationFlow;
