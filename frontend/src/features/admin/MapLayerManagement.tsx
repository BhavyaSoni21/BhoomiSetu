import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2, Plus, X, Trash2, Pencil, Lock } from 'lucide-react';
import apiService from '../../services/apiService';
import LayerGeometryDrawMap from './LayerGeometryDrawMap';

// Describes one of the GIS layer types this component can manage (Zoning
// Overlays, Restriction Zones, Infrastructure, Admin Notes) - the fields
// differ slightly per type (see backend/src/spatial/dto/*.ts), so this is
// config-driven rather than near-duplicate components. typeField and
// notesField are mutually exclusive ways a layer categorizes itself: a
// fixed enum (zoneType/restrictionType/featureType) vs. free-form text
// (Admin Notes has no fixed category) - a config sets at most one.
export interface LayerTypeConfig {
  key: string;
  endpoint: string; // e.g. '/gis/zoning-overlays'
  typeField?: string; // e.g. 'zoneType'
  typeFieldLabel?: string; // e.g. 'Zone Type'
  typeOptions?: string[];
  notesField?: string; // e.g. 'notes' - free-text alternative to typeField
  notesLabel?: string;
  idsField?: string; // e.g. 'parcelIds' | 'affectedParcelIds'
  idsLabel?: string;
  geometryTypes: string[]; // allowed GeoJSON geometry.type values
  geometryExample: string;
  // Visible/editable by Admin only (docs/ADMIN_PANEL_ISSUES.md Coming Soon
  // #3 follow-up) - shows a badge so it's clear at a glance this layer never
  // reaches the shared citizen/officer map.
  adminOnly?: boolean;
}

interface LayerFeature {
  type: 'Feature';
  properties: Record<string, unknown> & { id: string; name: string };
  geometry: GeoJSON.Geometry;
}

interface LayerFeatureCollection {
  type: 'FeatureCollection';
  features: LayerFeature[];
}

interface LayerForm {
  name: string;
  type: string;
  notes: string;
  stateCode: string;
  district: string;
  geometryText: string;
  idsText: string;
}

function emptyForm(config: LayerTypeConfig): LayerForm {
  return { name: '', type: config.typeOptions?.[0] ?? '', notes: '', stateCode: '', district: '', geometryText: '', idsText: '' };
}

function parseGeometry(text: string): GeoJSON.Geometry | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? (parsed as GeoJSON.Geometry) : null;
  } catch {
    return null;
  }
}

function buildPayload(config: LayerTypeConfig, form: LayerForm, geometry: Record<string, unknown>) {
  const payload: Record<string, unknown> = {
    name: form.name,
    stateCode: form.stateCode.toUpperCase(),
    district: form.district,
    geometry,
  };
  if (config.typeField) payload[config.typeField] = form.type;
  if (config.notesField) payload[config.notesField] = form.notes || undefined;
  if (config.idsField) {
    const ids = form.idsText.split(',').map((s) => s.trim()).filter(Boolean);
    payload[config.idsField] = ids;
  }
  return payload;
}

function extractErrorMessage(err: unknown, invalidJsonMessage: string, fallback: string): string {
  if (err instanceof Error && err.message === 'INVALID_JSON') {
    return invalidJsonMessage;
  }
  if (axios.isAxiosError(err) && err.response?.data?.message) {
    return String(err.response.data.message);
  }
  return fallback;
}

interface LayerFormFieldsProps {
  config: LayerTypeConfig;
  form: LayerForm;
  onChange: (form: LayerForm) => void;
}

const LayerFormFields: React.FC<LayerFormFieldsProps> = ({ config, form, onChange }) => {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <input
        type="text"
        placeholder={t('adminPortal.namePlaceholder')}
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
        className="px-3 py-2 border-2 border-ink bg-surface text-ink placeholder:text-ink/40 text-sm focus:outline-none focus:border-primary"
        required
      />
      {config.typeField && (
        <select
          value={form.type}
          onChange={(e) => onChange({ ...form, type: e.target.value })}
          className="px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
        >
          {(config.typeOptions ?? []).map((option) => (
            <option key={option} value={option}>
              {option.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      )}
      <input
        type="text"
        placeholder={t('adminPortal.stateCodePlaceholder')}
        value={form.stateCode}
        onChange={(e) => onChange({ ...form, stateCode: e.target.value })}
        className="px-3 py-2 border-2 border-ink bg-surface text-ink placeholder:text-ink/40 text-sm focus:outline-none focus:border-primary"
        required
      />
      <input
        type="text"
        placeholder={t('adminPortal.districtPlaceholder')}
        value={form.district}
        onChange={(e) => onChange({ ...form, district: e.target.value })}
        className="px-3 py-2 border-2 border-ink bg-surface text-ink placeholder:text-ink/40 text-sm focus:outline-none focus:border-primary"
        required
      />
      {config.idsField && (
        <input
          type="text"
          placeholder={t('adminPortal.idsFieldSuffix', { label: config.idsLabel ?? t('adminPortal.affectedParcelIdsLabel') })}
          value={form.idsText}
          onChange={(e) => onChange({ ...form, idsText: e.target.value })}
          className="px-3 py-2 border-2 border-ink bg-surface text-ink placeholder:text-ink/40 text-sm focus:outline-none focus:border-primary md:col-span-2"
        />
      )}
      {config.notesField && (
        <textarea
          placeholder={config.notesLabel ?? t('adminPortal.notesPlaceholderFallback')}
          value={form.notes}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
          className="px-3 py-2 border-2 border-ink bg-surface text-ink placeholder:text-ink/40 text-sm focus:outline-none focus:border-primary md:col-span-2"
          rows={2}
        />
      )}
      <div className="md:col-span-2">
        <LayerGeometryDrawMap
          allowedGeometryTypes={config.geometryTypes}
          initialGeometry={parseGeometry(form.geometryText)}
          onChange={(geometry) => onChange({ ...form, geometryText: geometry ? JSON.stringify(geometry, null, 2) : '' })}
        />
      </div>
      <div className="md:col-span-2">
        <textarea
          placeholder={t('adminPortal.geometryPlaceholder', { types: config.geometryTypes.join(' or '), example: config.geometryExample })}
          value={form.geometryText}
          onChange={(e) => onChange({ ...form, geometryText: e.target.value })}
          className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink placeholder:text-ink/40 text-sm font-mono focus:outline-none focus:border-primary"
          rows={4}
          required
        />
        <p className="text-[11px] text-ink/50 mt-1">{t('adminPortal.geometryHelperText')}</p>
      </div>
    </div>
  );
};

interface MapLayerManagementProps {
  config: LayerTypeConfig;
}

// Admin "Map Layer Authoring" (docs/ADMIN_PANEL_ISSUES.md Coming Soon #3) -
// form-based CRUD against the already-working GIS write APIs
// (backend/src/spatial/spatial.controller.ts, ADMIN-only), with a map-based
// drawing tool (LayerGeometryDrawMap) scoped only to this admin screen -
// the shared citizen/officer map (features/map/MapComponent.tsx) never
// gains drawing capability.
const MapLayerManagement: React.FC<MapLayerManagementProps> = ({ config }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<LayerForm>(() => emptyForm(config));
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LayerForm>(() => emptyForm(config));
  const [editError, setEditError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<LayerFeatureCollection>(['map-layer', config.key], async () => {
    const response = await apiService.get(config.endpoint);
    return response.data;
  });
  const features = data?.features ?? [];

  const invalidate = () => queryClient.invalidateQueries(['map-layer', config.key]);

  const createMutation = useMutation<unknown, unknown>(
    async () => {
      const geometry = parseGeometry(form.geometryText);
      if (!geometry) throw new Error('INVALID_JSON');
      const response = await apiService.post(config.endpoint, buildPayload(config, form, geometry as unknown as Record<string, unknown>));
      return response.data;
    },
    {
      onSuccess: () => {
        invalidate();
        setShowAddForm(false);
        setForm(emptyForm(config));
        setFormError(null);
      },
      onError: (err) => setFormError(extractErrorMessage(err, t('adminPortal.invalidGeometryError'), t('adminPortal.layerCreateError'))),
    },
  );

  const updateMutation = useMutation<unknown, unknown, { id: string }>(
    async ({ id }) => {
      const geometry = parseGeometry(editForm.geometryText);
      if (!geometry) throw new Error('INVALID_JSON');
      const response = await apiService.patch(`${config.endpoint}/${id}`, buildPayload(config, editForm, geometry as unknown as Record<string, unknown>));
      return response.data;
    },
    {
      onSuccess: () => {
        invalidate();
        setEditingId(null);
        setEditError(null);
      },
      onError: (err) => setEditError(extractErrorMessage(err, t('adminPortal.invalidGeometryError'), t('adminPortal.layerSaveError'))),
    },
  );

  const deleteMutation = useMutation<void, unknown, string>(
    async (id) => {
      await apiService.delete(`${config.endpoint}/${id}`);
    },
    { onSuccess: invalidate },
  );

  const startEdit = (feature: LayerFeature) => {
    setEditingId(feature.properties.id);
    setEditError(null);
    const ids = config.idsField ? (feature.properties[config.idsField] as string[] | undefined) ?? [] : [];
    setEditForm({
      name: feature.properties.name,
      type: config.typeField ? (feature.properties[config.typeField] as string | undefined) ?? config.typeOptions?.[0] ?? '' : '',
      notes: config.notesField ? (feature.properties[config.notesField] as string | undefined) ?? '' : '',
      stateCode: (feature.properties.stateCode as string | undefined) ?? '',
      district: (feature.properties.district as string | undefined) ?? '',
      geometryText: JSON.stringify(feature.geometry, null, 2),
      idsText: ids.join(', '),
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  const handleSaveEdit = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    updateMutation.mutate({ id });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-ink/60 py-3">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        {t('adminPortal.loadingLayers')}
      </div>
    );
  }
  if (error) return <div className="text-sm font-medium text-ink/60 py-3">{t('adminPortal.errorLoadingLayers')}</div>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        {config.adminOnly ? (
          <span className="inline-flex items-center gap-1.5 border-2 border-ink bg-accent text-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">
            <Lock className="w-3 h-3" aria-hidden="true" />
            {t('adminPortal.adminOnlyBadge')}
          </span>
        ) : (
          <span />
        )}
        <button
          onClick={() => setShowAddForm((open) => !open)}
          className="inline-flex items-center gap-2 border-2 border-ink bg-secondary hover:bg-secondary-strong text-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          {showAddForm ? <X className="w-3.5 h-3.5" aria-hidden="true" /> : <Plus className="w-3.5 h-3.5" aria-hidden="true" />}
          {showAddForm ? t('adminPortal.cancelCta') : t('adminPortal.addLayerCta')}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreate} className="border-2 border-ink bg-muted/40 p-4 mb-5 space-y-3">
          <LayerFormFields config={config} form={form} onChange={setForm} />
          {formError && <p className="text-xs font-bold text-secondary-strong">{formError}</p>}
          <button
            type="submit"
            disabled={createMutation.isLoading}
            className="inline-flex items-center gap-2 border-2 border-ink bg-primary hover:bg-primary-strong text-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
          >
            {createMutation.isLoading ? t('adminPortal.creatingLabel') : t('adminPortal.createLayerCta')}
          </button>
        </form>
      )}

      {features.length === 0 && <div className="text-sm font-medium text-ink/60 py-3">{t('adminPortal.noLayersYet')}</div>}

      <div className="border-2 border-ink divide-y-2 divide-ink bg-surface">
        {features.map((feature) => (
          <div key={feature.properties.id} className="px-3.5 py-3 text-sm">
            {editingId === feature.properties.id ? (
              <form onSubmit={(e) => handleSaveEdit(e, feature.properties.id)} className="space-y-2">
                <LayerFormFields config={config} form={editForm} onChange={setEditForm} />
                {editError && <p className="text-xs font-bold text-secondary-strong">{editError}</p>}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={updateMutation.isLoading}
                    className="inline-flex items-center gap-1.5 border-2 border-ink bg-primary hover:bg-primary-strong text-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition disabled:opacity-50"
                  >
                    {updateMutation.isLoading ? t('adminPortal.savingLabel') : t('adminPortal.saveCta')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="inline-flex items-center gap-1.5 border-2 border-ink px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink transition hover:bg-muted"
                  >
                    {t('adminPortal.cancelCta')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-ink">{String(feature.properties.name)}</span>
                  {config.typeField && (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-ink/40">
                      {String(feature.properties[config.typeField] ?? '')}
                    </span>
                  )}
                  <p className="text-xs text-ink/60 mt-0.5">
                    {String(feature.properties.stateCode ?? '—')}-{String(feature.properties.district ?? '—')} · {feature.geometry.type}
                  </p>
                  {config.notesField && feature.properties[config.notesField] ? (
                    <p className="text-xs text-ink/60 mt-0.5 italic">{String(feature.properties[config.notesField])}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(feature)}
                    className="inline-flex items-center gap-1.5 border-2 border-ink text-ink hover:bg-muted px-2 py-1.5 text-xs font-bold uppercase tracking-wide transition"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    {t('adminPortal.editCta')}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(t('adminPortal.deleteLayerConfirm', { name: String(feature.properties.name) }))) deleteMutation.mutate(feature.properties.id);
                    }}
                    disabled={deleteMutation.isLoading}
                    className="inline-flex items-center gap-1.5 border-2 border-ink text-secondary-strong hover:bg-secondary/10 px-2 py-1.5 text-xs font-bold uppercase tracking-wide transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    {t('adminPortal.deleteCta')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MapLayerManagement;
