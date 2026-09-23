import React, { useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { Upload, FileText, MapPin, Camera, Save, X, CheckCircle2, AlertTriangle, Loader2, Eye } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/apiService';
import BackButton from '../../components/BackButton';

interface SurveyDocument {
  id: string;
  parcelId: string;
  surveyId?: string;
  documentType: 'FIELD_SKETCH' | 'GPS_LOG' | 'PHOTO_EVIDENCE' | 'MEASUREMENT_SHEET' | 'BOUNDARY_MARKER' | 'OTHER';
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  uploadedBy: string;
  description?: string;
  gpsCoordinates?: { lat: number; lng: number };
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
}

interface SurveyRecord {
  id: string;
  parcelId: string;
  surveyType: 'INITIAL' | 'RESURVEY' | 'BOUNDARY_DEMARCATION' | 'SUBDIVISION' | 'AMALGAMATION' | 'COURT_COMMISSIONED';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED' | 'REJECTED';
  surveyorName: string;
  startedAt?: string;
  completedAt?: string;
  measuredArea?: number;
  recordedArea?: number;
  areaDelta?: number;
  geometryUpdated: boolean;
}

const DocumentsPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedParcelId, setSelectedParcelId] = useState<string>('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    documentType: 'FIELD_SKETCH' as SurveyDocument['documentType'],
    description: '',
    file: null as File | null,
    gpsLat: '',
    gpsLng: '',
  });

  const { data: surveyRecords = [], isLoading: loadingSurveys } = useQuery<SurveyRecord[]>(
    ['survey-records'],
    async () => (await apiService.get('/survey/records')).data,
  );

  const { data: documents = [], isLoading: loadingDocs } = useQuery<SurveyDocument[]>(
    ['survey-documents', selectedParcelId],
    async () => {
      if (!selectedParcelId) return [];
      return (await apiService.get(`/survey/documents`, { params: { parcelId: selectedParcelId } })).data;
    },
    { enabled: !!selectedParcelId },
  );

  const pendingSurveys = surveyRecords.filter(s => s.status === 'PENDING' || s.status === 'IN_PROGRESS').length;
  const inProgressSurveys = surveyRecords.filter(s => s.status === 'IN_PROGRESS').length;
  const completedToday = surveyRecords.filter(s => s.status === 'COMPLETED' && s.completedAt && new Date(s.completedAt).toDateString() === new Date().toDateString()).length;
  const geometryUpdated = surveyRecords.filter(s => s.geometryUpdated).length;

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return (await apiService.post('/survey/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-documents', selectedParcelId] });
      setShowUploadModal(false);
      setUploadForm({ documentType: 'FIELD_SKETCH', description: '', file: null, gpsLat: '', gpsLng: '' });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setUploadForm(prev => ({ ...prev, file: e.target.files![0] }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file || !selectedParcelId) return;

    const formData = new FormData();
    formData.append('file', uploadForm.file);
    formData.append('parcelId', selectedParcelId);
    formData.append('documentType', uploadForm.documentType);
    formData.append('description', uploadForm.description);
    if (uploadForm.gpsLat && uploadForm.gpsLng) {
      formData.append('gpsLat', uploadForm.gpsLat);
      formData.append('gpsLng', uploadForm.gpsLng);
    }

    uploadMutation.mutate(formData);
  };

  const viewDocument = async (doc: SurveyDocument) => {
    const res = await apiService.get(doc.fileUrl, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const getDocTypeColor = (type: SurveyDocument['documentType']) => {
    const colors: Record<SurveyDocument['documentType'], string> = {
      FIELD_SKETCH: 'bg-blue-100 text-blue-800',
      GPS_LOG: 'bg-green-100 text-green-800',
      PHOTO_EVIDENCE: 'bg-purple-100 text-purple-800',
      MEASUREMENT_SHEET: 'bg-amber-100 text-amber-800',
      BOUNDARY_MARKER: 'bg-red-100 text-red-800',
      OTHER: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getSurveyStatusColor = (status: SurveyRecord['status']) => {
    const colors: Record<SurveyRecord['status'], string> = {
      PENDING: 'bg-amber-100 text-amber-900',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      VERIFIED: 'bg-indigo-100 text-indigo-800',
      REJECTED: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6 animate-fade-up max-w-7xl">
      <BackButton />
      <div className="pb-4 border-b border-gov-border">
        <div className="flex items-center gap-2 text-brand-700 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <FileText className="w-4 h-4 text-action-600" />
          <span>{t('officerDashboard.documentsHeading')}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-heading">
          {t('officerNav.documents', 'Field Documents')}
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1">
          {t('officerDashboard.documentsDesc', 'Upload field evidence (GPS logs, photos, sketches) for survey measurements. Survey Officer verifies map/change detection overlays.')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="gov-card p-4 border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('officerDashboard.pendingSurveysLabel')}</span>
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-amber-700">{pendingSurveys}</div>
        </div>
        <div className="gov-card p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('officerDashboard.inProgressFieldworkLabel')}</span>
            <Upload className="w-5 h-5 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-blue-700">{inProgressSurveys}</div>
        </div>
        <div className="gov-card p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('officerDashboard.completedTodayLabel')}</span>
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-green-700">{completedToday}</div>
        </div>
        <div className="gov-card p-4 border-l-4 border-indigo-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('officerDashboard.geometryUpdatedLabel')}</span>
            <MapPin className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-indigo-700">{geometryUpdated}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Survey Records List */}
        <div className="lg:col-span-1 gov-card p-6">
          <h2 className="font-heading font-bold text-lg text-text-heading mb-5 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-700" />
            {t('officerDashboard.surveyRecordsHeading', 'Survey Records')} ({surveyRecords.length})
          </h2>

          {loadingSurveys ? (
            <div className="py-8 text-center text-sm text-text-muted">{t('officerDashboard.loadingPendingQueue')}</div>
          ) : surveyRecords.length === 0 ? (
            <div className="py-8 text-center rounded-xl bg-surface-2 border border-gov-border">
              <FileText className="w-8 h-8 mx-auto text-text-muted mb-2" />
              <p className="text-sm font-semibold text-text-heading">{t('officerDashboard.noSurveyRecords', 'No survey records found')}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {surveyRecords.map((survey) => (
                <button
                  key={survey.id}
                  onClick={() => setSelectedParcelId(survey.parcelId)}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    selectedParcelId === survey.parcelId
                      ? 'border-brand-700 bg-brand-900/[0.04] shadow-sm'
                      : 'border-gov-border hover:bg-surface-2/60 bg-surface-1'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-medium text-text-heading">{survey.parcelId.slice(0, 12)}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold ${getSurveyStatusColor(survey.status)}`}>
                      {t(`officerDashboard.surveyStatus.${survey.status.toLowerCase()}`, survey.status.replace(/_/g, ' '))}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary capitalize">{survey.surveyType.toLowerCase().replace(/_/g, ' ')}</p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] font-mono text-text-muted">
                    {survey.measuredArea && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {t('officerDashboard.measuredAreaLabel')}: {survey.measuredArea} m²
                      </span>
                    )}
                    {survey.areaDelta !== undefined && (
                      <span className={`flex items-center gap-1 ${survey.areaDelta !== 0 ? 'text-amber-600' : 'text-green-600'}`}>
                        <AlertTriangle className="w-3 h-3" />
                        Δ {survey.areaDelta >= 0 ? '+' : ''}{survey.areaDelta} m²
                      </span>
                    )}
                    {survey.geometryUpdated && (
                      <span className="flex items-center gap-1 text-indigo-600">
                        <CheckCircle2 className="w-3 h-3" />
                        {t('officerDashboard.geometryUpdatedBadge')}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Documents for Selected Parcel */}
        <div className="lg:col-span-2 gov-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading font-bold text-lg text-text-heading flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-700" />
              {t('officerDashboard.fieldDocumentsHeading', 'Field Documents')}
              {selectedParcelId && <span className="font-mono text-brand-900 ml-2">{selectedParcelId.slice(0, 12)}</span>}
            </h2>
            {selectedParcelId && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white bg-brand-900 hover:bg-brand-700 transition"
              >
                <Upload className="w-4 h-4" />
                {t('officerDashboard.uploadDocumentButton')}
              </button>
            )}
          </div>

          {!selectedParcelId ? (
            <div className="py-20 text-center rounded-xl bg-surface-2 border border-gov-border">
              <FileText className="w-12 h-12 mx-auto text-text-muted mb-3 opacity-50" />
              <p className="text-sm font-semibold text-text-heading">{t('officerDashboard.selectSurveyRecordHeading')}</p>
              <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                {t('officerDashboard.selectSurveyRecordDesc', 'Select a survey record from the list to view and upload field documents.')}
              </p>
            </div>
          ) : loadingDocs ? (
            <div className="py-12 text-center text-sm text-text-muted">{t('officerDashboard.loadingPendingQueue')}</div>
          ) : documents.length === 0 ? (
            <div className="py-10 text-center rounded-xl bg-surface-2 border border-gov-border">
              <Upload className="w-8 h-8 mx-auto text-text-muted mb-2" />
              <p className="text-sm font-semibold text-text-heading">{t('officerDashboard.noDocumentsUploaded', 'No documents uploaded yet')}</p>
              <p className="text-xs text-text-secondary mt-1">{t('officerDashboard.uploadFirstDocumentDesc', 'Upload the first field document for this survey.')}</p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white bg-brand-900 hover:bg-brand-700 transition"
              >
                <Upload className="w-4 h-4" />
                {t('officerDashboard.uploadDocumentButton')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {documents.map((doc) => (
                <div key={doc.id} className="p-4 rounded-xl border border-gov-border bg-surface-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold ${getDocTypeColor(doc.documentType)}`}>
                      {doc.documentType.replace(/_/g, ' ')}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold ${doc.verified ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                      {doc.verified ? t('officerDashboard.verifiedLabel') : t('officerDashboard.pendingVerificationLabel')}
                    </span>
                  </div>

                  <p className="font-mono text-sm text-text-heading truncate">{doc.fileName}</p>
                  {doc.description && <p className="text-xs text-text-secondary">{doc.description}</p>}

                  <div className="flex flex-wrap gap-2 text-[10px] font-mono text-text-muted">
                    {doc.gpsCoordinates && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {doc.gpsCoordinates.lat.toFixed(6)}, {doc.gpsCoordinates.lng.toFixed(6)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Camera className="w-3 h-3" />
                      {doc.uploadedBy}
                    </span>
                    <span>
                      {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : '—'}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-gov-border flex items-center justify-end gap-2">
                    <button
                      onClick={() => viewDocument(doc)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-brand-900 bg-brand-100 hover:bg-brand-200 transition"
                    >
                      <Eye className="w-3 h-3" />
                      {t('officerDashboard.viewButton')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gov-border flex items-center justify-between">
              <h3 className="font-heading font-bold text-lg text-text-heading">{t('officerDashboard.uploadDocumentTitle')}</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-text-muted hover:text-text-heading">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">{t('officerDashboard.documentTypeLabel')}</label>
                <select
                  value={uploadForm.documentType}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, documentType: e.target.value as SurveyDocument['documentType'] }))}
                  className="w-full px-4 py-2 rounded-xl border border-gov-border bg-surface-1 text-sm text-text-heading focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  <option value="FIELD_SKETCH">{t('officerDashboard.docTypeFieldSketch')}</option>
                  <option value="GPS_LOG">{t('officerDashboard.docTypeGpsLog')}</option>
                  <option value="PHOTO_EVIDENCE">{t('officerDashboard.docTypePhotoEvidence')}</option>
                  <option value="MEASUREMENT_SHEET">{t('officerDashboard.docTypeMeasurementSheet')}</option>
                  <option value="BOUNDARY_MARKER">{t('officerDashboard.docTypeBoundaryMarker')}</option>
                  <option value="OTHER">{t('officerDashboard.docTypeOther')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">{t('officerDashboard.descriptionLabel')}</label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2 rounded-xl border border-gov-border bg-surface-1 text-sm text-text-heading focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder={t('officerDashboard.descriptionPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">{t('officerDashboard.gpsCoordinatesLabel')}</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    step="any"
                    placeholder={t('officerDashboard.latitudePlaceholder')}
                    value={uploadForm.gpsLat}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, gpsLat: e.target.value }))}
                    className="px-4 py-2 rounded-xl border border-gov-border bg-surface-1 text-sm text-text-heading focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder={t('officerDashboard.longitudePlaceholder')}
                    value={uploadForm.gpsLng}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, gpsLng: e.target.value }))}
                    className="px-4 py-2 rounded-xl border border-gov-border bg-surface-1 text-sm text-text-heading focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">{t('officerDashboard.fileLabel')}</label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*,application/pdf,.gpx,.kml,.csv"
                  className="w-full px-4 py-2 rounded-xl border border-gov-border bg-surface-1 text-sm text-text-heading focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  required
                />
                {uploadForm.file && (
                  <p className="mt-1 text-xs text-text-secondary font-mono">{uploadForm.file.name} ({(uploadForm.file.size / 1024).toFixed(1)} KB)</p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-bold text-text-heading bg-surface-2 hover:bg-surface-3 transition"
                >
                  {t('officerDashboard.cancelButton')}
                </button>
                <button
                  type="submit"
                  disabled={uploadMutation.isPending || !uploadForm.file}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-bold text-white bg-brand-900 hover:bg-brand-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      {t('officerDashboard.uploadingButton')}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {t('officerDashboard.saveButton')}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;