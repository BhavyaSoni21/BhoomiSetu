import React, { useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { Search, FileCheck2, Eye, Download, FileText, ShieldCheck, AlertTriangle, Calendar } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/apiService';
import BackButton from '../../components/BackButton';

interface EncumbranceCertificate {
  id: string;
  certificateNumber: string;
  parcelId: string;
  ulpin: string;
  ownerName: string;
  issuedAt: string;
  validUntil: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'DRAFT';
  encumbrances: {
    type: 'MORTGAGE' | 'CHARGE' | 'LIEN' | 'LEASE' | 'COURT_ORDER';
    description: string;
    amount: number;
    registeredAt: string;
    status: 'ACTIVE' | 'RELEASED' | 'DISPUTED';
  }[];
  issuedBy: string;
  purpose: 'SALE' | 'MORTGAGE' | 'LEASE' | 'COURT' | 'VERIFICATION';
}

interface CertificateRequest {
  parcelId: string;
  purpose: 'SALE' | 'MORTGAGE' | 'LEASE' | 'COURT' | 'VERIFICATION';
  requestedBy: string;
  requestedAt: string;
  status: 'PENDING' | 'GENERATED' | 'REJECTED';
}

const CertificateGeneratorPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'generate' | 'issued'>('generate');

  const { data: certificates = [], isLoading: loadingCerts } = useQuery<EncumbranceCertificate[]>(
    ['encumbrance-certificates'],
    async () => (await apiService.get('/encumbrance/certificates')).data,
  );

  const { data: requests = [], isLoading: loadingRequests } = useQuery<CertificateRequest[]>(
    ['certificate-requests'],
    async () => (await apiService.get('/encumbrance/certificate-requests')).data,
  );

  const generateMutation = useMutation(
    async (parcelId: string) => (await apiService.post('/encumbrance/certificates/generate', { parcelId })).data,
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['encumbrance-certificates']);
        queryClient.invalidateQueries(['certificate-requests']);
        setActiveTab('issued');
      },
    },
  );

  const activeCerts = certificates.filter(c => c.status === 'ACTIVE').length;
  const expiredCerts = certificates.filter(c => c.status === 'EXPIRED').length;
  const pendingRequests = requests.filter(r => r.status === 'PENDING').length;

  const getStatusColor = (status: EncumbranceCertificate['status']) => {
    const colors: Record<EncumbranceCertificate['status'], string> = {
      ACTIVE: 'bg-green-100 text-green-800',
      EXPIRED: 'bg-gray-100 text-gray-800',
      REVOKED: 'bg-red-100 text-red-800',
      DRAFT: 'bg-amber-100 text-amber-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getEncumbranceTypeColor = (type: EncumbranceCertificate['encumbrances'][0]['type']) => {
    const colors: Record<EncumbranceCertificate['encumbrances'][0]['type'], string> = {
      MORTGAGE: 'bg-blue-100 text-blue-800',
      CHARGE: 'bg-purple-100 text-purple-800',
      LIEN: 'bg-red-100 text-red-800',
      LEASE: 'bg-green-100 text-green-800',
      COURT_ORDER: 'bg-red-100 text-red-800 border border-red-300',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getRequestStatusColor = (status: CertificateRequest['status']) => {
    const colors: Record<CertificateRequest['status'], string> = {
      PENDING: 'bg-amber-100 text-amber-900',
      GENERATED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleGenerateCertificate = (request: CertificateRequest) => {
    generateMutation.mutate(request.parcelId);
  };

  const openCertificatePdf = async (cert: EncumbranceCertificate, download: boolean) => {
    const res = await apiService.get(`/encumbrance/certificates/${cert.id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    if (download) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cert.certificateNumber}.pdf`;
      a.click();
    } else {
      window.open(url, '_blank');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <div className="space-y-6 animate-fade-up max-w-7xl">
      <BackButton />
      <div className="pb-4 border-b border-gov-border">
        <div className="flex items-center gap-2 text-brand-700 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <FileText className="w-4 h-4 text-action-600" />
          <span>{t('officerDashboard.certificateGeneratorHeading')}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-heading">
          {t('officerNav.certificateGenerator', 'Certificate Generator')}
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1">
          {t('officerDashboard.certificateGeneratorDesc', 'Issue encumbrance certificates (PDF). Core Encumbrance Officer workflow — review pending requests, generate certificates with all active encumbrances listed.')}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="gov-card p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('officerDashboard.activeCertificatesLabel')}</span>
            <ShieldCheck className="w-5 h-5 text-green-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-green-700">{activeCerts}</div>
        </div>
        <div className="gov-card p-4 border-l-4 border-gray-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('officerDashboard.expiredCertificatesLabel')}</span>
            <Calendar className="w-5 h-5 text-gray-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-gray-700">{expiredCerts}</div>
        </div>
        <div className="gov-card p-4 border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('officerDashboard.pendingRequestsLabel')}</span>
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-amber-700">{pendingRequests}</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="gov-card">
        <div className="border-b border-gov-border">
          <nav className="flex -mb-px" aria-label="Certificate tabs">
            <button
              onClick={() => setActiveTab('generate')}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'generate'
                  ? 'border-brand-700 text-brand-900'
                  : 'border-transparent text-text-muted hover:text-text-heading'
              }`}
            >
              {t('officerDashboard.generateTab', 'Generate Certificates')} ({pendingRequests})
            </button>
            <button
              onClick={() => setActiveTab('issued')}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'issued'
                  ? 'border-brand-700 text-brand-900'
                  : 'border-transparent text-text-muted hover:text-text-heading'
              }`}
            >
              {t('officerDashboard.issuedTab', 'Issued Certificates')} ({certificates.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Generate Tab */}
          {activeTab === 'generate' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="font-heading font-bold text-lg text-text-heading flex items-center gap-2">
                  <FileText className="w-5 h-5 text-brand-700" />
                  {t('officerDashboard.pendingCertificateRequestsHeading', 'Pending Certificate Requests')}
                </h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="text"
                    placeholder={t('officerDashboard.searchParcelPlaceholder', 'Search by parcel ID...')}
                    className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-xl border border-gov-border bg-surface-1 text-sm text-text-heading placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>

              {loadingRequests ? (
                <div className="py-12 text-center text-sm text-text-muted">{t('officerDashboard.loadingPendingQueue')}</div>
              ) : requests.filter(r => r.status === 'PENDING').length === 0 ? (
                <div className="py-10 text-center rounded-xl bg-surface-2 border border-gov-border">
                  <FileCheck2 className="w-8 h-8 mx-auto text-gov-success mb-2" />
                  <p className="text-sm font-semibold text-text-heading">{t('officerDashboard.noPendingRequests', 'No pending certificate requests')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gov-border text-text-muted uppercase font-mono text-[11px]">
                        <th className="pb-3 font-semibold">{t('officerDashboard.tableColParcelId')}</th>
                        <th className="pb-3 font-semibold">{t('officerDashboard.tableColPurpose')}</th>
                        <th className="pb-3 font-semibold">{t('officerDashboard.tableColRequestedBy')}</th>
                        <th className="pb-3 font-semibold">{t('officerDashboard.tableColRequestedDate')}</th>
                        <th className="pb-3 font-semibold">{t('officerDashboard.tableColStatus')}</th>
                        <th className="pb-3 font-semibold text-right">{t('officerDashboard.tableColActions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gov-border">
                      {requests.filter(r => r.status === 'PENDING').map((req) => (
                        <tr key={req.parcelId} className="hover:bg-surface-2/60 transition-colors">
                          <td className="py-3 font-mono font-medium text-text-heading">{req.parcelId.slice(0, 12)}</td>
                          <td className="py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold bg-brand-100 text-brand-800">
                              {req.purpose}
                            </span>
                          </td>
                          <td className="py-3 text-text-primary">{req.requestedBy}</td>
                          <td className="py-3 text-text-secondary font-mono">
                            {req.requestedAt ? new Date(req.requestedAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold ${getRequestStatusColor(req.status)}`}>
                              {t(`officerDashboard.requestStatus.${req.status.toLowerCase()}`, req.status)}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => handleGenerateCertificate(req)}
                              disabled={generateMutation.isLoading}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-brand-900 hover:bg-brand-700 transition disabled:opacity-50"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              {t('officerDashboard.generateButton')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Issued Tab */}
          {activeTab === 'issued' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="font-heading font-bold text-lg text-text-heading flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-brand-700" />
                  {t('officerDashboard.issuedCertificatesHeading', 'Issued Certificates')}
                </h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="text"
                    placeholder={t('officerDashboard.searchCertPlaceholder', 'Search by certificate number, parcel ID...')}
                    className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-xl border border-gov-border bg-surface-1 text-sm text-text-heading placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>

              {loadingCerts ? (
                <div className="py-12 text-center text-sm text-text-muted">{t('officerDashboard.loadingPendingQueue')}</div>
              ) : certificates.length === 0 ? (
                <div className="py-10 text-center rounded-xl bg-surface-2 border border-gov-border">
                  <FileText className="w-8 h-8 mx-auto text-text-muted mb-2" />
                  <p className="text-sm font-semibold text-text-heading">{t('officerDashboard.noCertificatesIssued', 'No certificates issued yet')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gov-border text-text-muted uppercase font-mono text-[11px]">
                        <th className="pb-3 font-semibold">{t('officerDashboard.tableColCertificateNo')}</th>
                        <th className="pb-3 font-semibold">{t('officerDashboard.tableColParcelId')}</th>
                        <th className="pb-3 font-semibold">{t('officerDashboard.tableColOwner')}</th>
                        <th className="pb-3 font-semibold">{t('officerDashboard.tableColIssueDate')}</th>
                        <th className="pb-3 font-semibold">{t('officerDashboard.tableColValidity')}</th>
                        <th className="pb-3 font-semibold">{t('officerDashboard.tableColStatus')}</th>
                        <th className="pb-3 font-semibold">{t('officerDashboard.tableColEncumbrances')}</th>
                        <th className="pb-3 font-semibold text-right">{t('officerDashboard.tableColActions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gov-border">
                      {certificates.map((cert) => (
                        <tr key={cert.id} className="hover:bg-surface-2/60 transition-colors">
                          <td className="py-3 font-mono font-bold text-brand-900">{cert.certificateNumber}</td>
                          <td className="py-3 font-mono text-text-primary">{cert.parcelId.slice(0, 12)}</td>
                          <td className="py-3 text-text-heading">{cert.ownerName}</td>
                          <td className="py-3 text-text-secondary font-mono">
                            {cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3 text-text-secondary font-mono">
                            {cert.validUntil ? new Date(cert.validUntil).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold ${getStatusColor(cert.status)}`}>
                              {t(`officerDashboard.certStatus.${cert.status.toLowerCase()}`, cert.status)}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-1">
                              {cert.encumbrances.slice(0, 3).map((enc, idx) => (
                                <span key={idx} className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[9px] font-semibold ${getEncumbranceTypeColor(enc.type)}`}>
                                  {enc.type}
                                </span>
                              ))}
                              {cert.encumbrances.length > 3 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[9px] font-semibold bg-gray-100 text-gray-800">
                                  +{cert.encumbrances.length - 3}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => openCertificatePdf(cert, false)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-brand-900 bg-brand-100 hover:bg-brand-200 transition">
                                <Eye className="w-3 h-3" />
                                {t('officerDashboard.viewButton')}
                              </button>
                              <button onClick={() => openCertificatePdf(cert, true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-brand-900 hover:bg-brand-700 transition">
                                <Download className="w-3 h-3" />
                                {t('officerDashboard.downloadPdfButton')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CertificateGeneratorPage;