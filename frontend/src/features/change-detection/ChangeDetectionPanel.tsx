import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ScanSearch, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import apiService from '../../services/apiService';
import { ChangeAnalysisResponse, ClusterOption } from '../../types/changeDetection';
import { useTranslation } from '../../context/LanguageContext';
import { STATES_AND_DISTRICTS } from '../../data/locationData';

const STATE_NAME_BY_CODE: Record<string, string> = Object.fromEntries(
  STATES_AND_DISTRICTS.map((s) => [s.code, s.name]),
);

const ChangeDetectionPanel: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [source, setSource] = useState<'upload' | 'satellite'>('upload');
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [selectedState, setSelectedState] = useState('');
  const [selectedClusterId, setSelectedClusterId] = useState('');
  const [beforeDate, setBeforeDate] = useState('');
  const [afterDate, setAfterDate] = useState('');
  const [description, setDescription] = useState('');

  const { data: clusters = [] } = useQuery<ClusterOption[]>(['change-detection-clusters'], async () => {
    const response = await apiService.get('/change-detection/clusters');
    return response.data;
  });

  const stateOptions = useMemo(() => {
    const codes = Array.from(new Set(clusters.map((c) => c.stateCode))).sort();
    return codes.map((code) => ({ code, name: STATE_NAME_BY_CODE[code] ?? code }));
  }, [clusters]);

  const clusterOptionsForState = useMemo(
    () => clusters.filter((c) => c.stateCode === selectedState),
    [clusters, selectedState],
  );

  const selectedCluster = clusters.find((c) => c.clusterId === selectedClusterId) ?? null;
  const bounds = selectedCluster
    ? {
        minLng: String(selectedCluster.bounds.minLng), minLat: String(selectedCluster.bounds.minLat),
        maxLng: String(selectedCluster.bounds.maxLng), maxLat: String(selectedCluster.bounds.maxLat),
      }
    : { minLng: '', minLat: '', maxLng: '', maxLat: '' };

  const mutation = useMutation<ChangeAnalysisResponse, Error>(async () => {
    if (source === 'satellite') {
      // Real Earth Engine imagery - each submit here costs 2 EE reads
      // (before + after), so this is a deliberate single-click action,
      // never auto-triggered on bounds/date change.
      const response = await apiService.post(
        '/change-detection/analyze-satellite',
        {
          bounds: {
            minLng: parseFloat(bounds.minLng), minLat: parseFloat(bounds.minLat),
            maxLng: parseFloat(bounds.maxLng), maxLat: parseFloat(bounds.maxLat),
          },
          beforeDate,
          afterDate,
          description: description.trim() || undefined,
        },
        // apiService's default 10s timeout is fine for everything else, but
        // this fetches two live Earth Engine images sequentially (each can
        // take 10-30s) - needs real headroom, not the default.
        { timeout: 90000 },
      );
      return response.data;
    }

    const formData = new FormData();
    formData.append('before', beforeFile!);
    formData.append('after', afterFile!);
    formData.append('minLng', bounds.minLng);
    formData.append('minLat', bounds.minLat);
    formData.append('maxLng', bounds.maxLng);
    formData.append('maxLat', bounds.maxLat);
    if (description.trim()) formData.append('description', description.trim());

    // apiService defaults every request to Content-Type: application/json;
    // for a FormData body that must be unset (not just relabeled) so the
    // browser can generate the multipart boundary itself - otherwise the
    // server can't parse the body as multipart at all.
    const response = await apiService.post('/change-detection/analyze', formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCluster) return;
    if (source === 'satellite') {
      if (!beforeDate || !afterDate) return;
    } else if (!beforeFile || !afterFile) {
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="bg-surface border-4 border-ink shadow-hard-lg p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight font-display text-ink mb-1 flex items-center gap-2">
        <ScanSearch className="w-5 h-5 text-secondary" aria-hidden="true" />
        {t('changeDetectionPanel.heading')}
      </h2>
      <p className="text-sm text-ink/60 mb-4">
        {t('changeDetectionPanel.intro')}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-4 border-2 border-ink bg-muted/40 p-3">
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink cursor-pointer">
            <input type="radio" name="cd-source" checked={source === 'upload'} onChange={() => setSource('upload')} />
            {t('changeDetectionPanel.sourceUpload')}
          </label>
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink cursor-pointer">
            <input type="radio" name="cd-source" checked={source === 'satellite'} onChange={() => setSource('satellite')} />
            {t('changeDetectionPanel.sourceSatellite')}
          </label>
        </div>

        {source === 'upload' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cd-before-image" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">{t('changeDetectionPanel.beforeImage')}</label>
              <input
                id="cd-before-image"
                type="file"
                accept="image/*"
                onChange={(e) => setBeforeFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm border-2 border-ink bg-surface file:mr-3 file:my-1.5 file:ml-1.5 file:py-1.5 file:px-3 file:border-2 file:border-ink file:bg-secondary file:text-white file:font-bold file:text-xs file:uppercase file:tracking-wide file:cursor-pointer"
                required
              />
            </div>
            <div>
              <label htmlFor="cd-after-image" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">{t('changeDetectionPanel.afterImage')}</label>
              <input
                id="cd-after-image"
                type="file"
                accept="image/*"
                onChange={(e) => setAfterFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm border-2 border-ink bg-surface file:mr-3 file:my-1.5 file:ml-1.5 file:py-1.5 file:px-3 file:border-2 file:border-ink file:bg-secondary file:text-white file:font-bold file:text-xs file:uppercase file:tracking-wide file:cursor-pointer"
                required
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cd-before-date" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">{t('changeDetectionPanel.beforeDate')}</label>
              <input
                id="cd-before-date"
                type="date"
                value={beforeDate}
                onChange={(e) => setBeforeDate(e.target.value)}
                className="w-full px-2.5 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
                required
              />
            </div>
            <div>
              <label htmlFor="cd-after-date" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">{t('changeDetectionPanel.afterDate')}</label>
              <input
                id="cd-after-date"
                type="date"
                value={afterDate}
                onChange={(e) => setAfterDate(e.target.value)}
                className="w-full px-2.5 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
                required
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-ink mb-1.5">{t('changeDetectionPanel.boundsLabel')}</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="cd-state" className="block text-[11px] font-bold uppercase tracking-widest text-ink/60 mb-1">{t('changeDetectionPanel.stateLabel')}</label>
              <select
                id="cd-state"
                value={selectedState}
                onChange={(e) => { setSelectedState(e.target.value); setSelectedClusterId(''); }}
                className="w-full px-2.5 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
                required
              >
                <option value="" disabled>{t('changeDetectionPanel.selectState')}</option>
                {stateOptions.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cd-cluster" className="block text-[11px] font-bold uppercase tracking-widest text-ink/60 mb-1">{t('changeDetectionPanel.villageLabel')}</label>
              <select
                id="cd-cluster"
                value={selectedClusterId}
                onChange={(e) => setSelectedClusterId(e.target.value)}
                disabled={!selectedState}
                className="w-full px-2.5 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary disabled:opacity-50"
                required
              >
                <option value="" disabled>{t('changeDetectionPanel.selectVillage')}</option>
                {clusterOptionsForState.map((c) => (
                  <option key={c.clusterId} value={c.clusterId}>
                    {c.district} ({c.type === 'city' ? t('changeDetectionPanel.typeCity') : t('changeDetectionPanel.typeVillage')})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {selectedCluster && (
            <p className="text-[11px] text-ink/50 mt-1.5 font-mono">
              {bounds.minLng}, {bounds.minLat} &rarr; {bounds.maxLng}, {bounds.maxLat}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="cd-description" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">{t('changeDetectionPanel.descriptionOptional')}</label>
          <input
            id="cd-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink focus:outline-none focus:border-primary"
            placeholder="e.g. Satellite pass comparison, Sept 2026"
          />
        </div>

        {mutation.isError && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-secondary-strong">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            {axios.isAxiosError(mutation.error) && mutation.error.response?.status === 400
              ? t('changeDetectionPanel.errorBadInput')
              : axios.isAxiosError(mutation.error) && mutation.error.response?.status === 503
              ? t('changeDetectionPanel.errorSatelliteUnavailable')
              : axios.isAxiosError(mutation.error) && mutation.error.code === 'ECONNABORTED'
              ? t('changeDetectionPanel.errorTimeout')
              : t('changeDetectionPanel.errorGeneric')}
          </p>
        )}

        <button
          type="submit"
          disabled={
            mutation.isLoading ||
            !selectedCluster ||
            (source === 'upload' ? !beforeFile || !afterFile : !beforeDate || !afterDate)
          }
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-bold text-xs uppercase tracking-widest border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
        >
          <ScanSearch className="w-4 h-4" aria-hidden="true" />
          {mutation.isLoading ? t('changeDetectionPanel.analyzing') : t('changeDetectionPanel.analyze')}
        </button>
      </form>

      {mutation.isSuccess && (
        <div className="mt-4 border-t-4 border-ink pt-4">
          {mutation.data.changeDetected ? (
            <div className="border-2 border-ink border-l-4 border-l-secondary bg-secondary/10 p-4 space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                <AlertTriangle className="w-4 h-4 text-secondary shrink-0" aria-hidden="true" />
                {t('changeDetectionPanel.changeDetected', { pct: (mutation.data.changedPixelRatio * 100).toFixed(1) })}
              </p>
              <p className="text-sm text-ink/70">
                {t('changeDetectionPanel.affectedSummary', { parcels: mutation.data.affectedParcelIds.length, alerts: mutation.data.alertsCreated })}
              </p>
              {mutation.data.affectedParcelIds.length > 0 && (
                <div className="border-2 border-ink divide-y-2 divide-ink bg-surface">
                  {mutation.data.affectedParcelIds.map((parcelId) => (
                    <div key={parcelId} className="flex items-center justify-between text-sm px-3 py-2">
                      <span className="text-ink/70">{t('myParcels.parcelHash', { id: parcelId.substring(0, 8) })}</span>
                      <button
                        onClick={() => navigate(`/parcels/${parcelId}`)}
                        className="px-3 py-1 bg-primary text-white text-xs font-bold uppercase tracking-widest border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                      >
                        {t('myParcels.view')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-ink/70 border-2 border-ink border-l-4 border-l-primary bg-primary/10 p-4">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              {t('changeDetectionPanel.noChange', { pct: (mutation.data.changedPixelRatio * 100).toFixed(2) })}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ChangeDetectionPanel;
