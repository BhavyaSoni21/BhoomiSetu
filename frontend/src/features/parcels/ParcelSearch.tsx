import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { useNavigate, useSearchParams as useUrlSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw, Search } from 'lucide-react';
import apiService from '../../services/apiService';
import { ParcelSummary } from '../../types/parcel';
import MicButton from '../../components/MicButton';
import { STATES_AND_DISTRICTS } from '../../data/locationData';

interface ParcelSearchProps {
  onResultsChange?: (parcels: ParcelSummary[]) => void;
  selectedParcelId?: string | null;
  onSelectParcel?: (parcelId: string) => void;
  // Optional extra per-result action (e.g. Land Claim's "Claim This
  // Parcel" button, CitizenDashboardPage) - rendered alongside the default
  // View button, not instead of it.
  renderResultAction?: (parcel: ParcelSummary) => React.ReactNode;
}

const inputClass =
  'w-full px-3 py-2 border-2 border-ink bg-surface text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary transition';
const labelClass = 'block text-xs font-bold uppercase tracking-widest text-ink mb-1';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8000/api/v1';

const ParcelSearch: React.FC<ParcelSearchProps> = ({ onResultsChange, selectedParcelId, onSelectParcel, renderResultAction }) => {
  const { t, currentLang } = useTranslation();
  const navigate = useNavigate();
  const [urlParams] = useUrlSearchParams();
  const [transliteratedText, setTransliteratedText] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useState({
    ulpin: '',
    survey_number: '',
    plot_number: '',
    local_identifier: urlParams.get('local_identifier') ?? '',
    state: '',
    district: '',
  });

  // Picks up ?local_identifier= from the navbar quick-search, including when
  // it changes while this route is already mounted (React Router doesn't
  // remount on a query-only navigation to the same path).
  useEffect(() => {
    const fromUrl = urlParams.get('local_identifier');
    if (fromUrl) {
      setSearchParams((prev) => ({ ...prev, local_identifier: fromUrl }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlParams]);

  const { data: searchResults, isLoading, error } = useQuery<ParcelSummary[]>(
    ['parcels', searchParams, currentLang],
    async () => {
      let effectiveLocalId = searchParams.local_identifier;

      // Check if text is Roman/Latin script and current language is non-English
      if (effectiveLocalId && currentLang !== 'en' && /[a-zA-Z]/.test(effectiveLocalId)) {
        try {
          const res = await fetch(`${API_BASE}/multilingual/transliterate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: effectiveLocalId,
              source_lang: 'en',
              target_lang: currentLang,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.transliterated_text) {
              effectiveLocalId = data.transliterated_text;
              setTransliteratedText(data.transliterated_text);
            } else {
              setTransliteratedText(null);
            }
          } else {
            setTransliteratedText(null);
          }
        } catch (err) {
          console.error('Transliteration failed, falling back to original query:', err);
          setTransliteratedText(null);
        }
      } else {
        setTransliteratedText(null);
      }

      // Filter out empty params
      const params = Object.entries({
        ...searchParams,
        local_identifier: effectiveLocalId || searchParams.local_identifier,
      })
        .filter(([_, value]) => value !== '')
        .reduce((obj, [key, value]) => {
          obj[key as keyof typeof searchParams] = value as string;
          return obj;
        }, {} as typeof searchParams);

      const response = await apiService.get('/parcels', { params });
      return response.data.parcels;
    }
  );

  useEffect(() => {
    onResultsChange?.(searchResults ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchResults]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSearchParams(prev => ({ ...prev, [name]: value }));
  };

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedState = e.target.value;
    setSearchParams(prev => ({
      ...prev,
      state: selectedState,
      district: '', // Reset district when state changes
    }));
  };

  const selectedStateObj = STATES_AND_DISTRICTS.find(
    (st) => st.code === searchParams.state || st.name.toLowerCase() === searchParams.state.toLowerCase()
  );
  const availableDistricts = selectedStateObj ? selectedStateObj.districts : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Search results already update live as searchParams changes; nothing to trigger here.
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6">
        <h2 className="text-lg font-black uppercase tracking-tight font-display text-ink mb-4">{t('parcelSearch.title')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>
                {t('parcelSearch.ulpinLabel')}
              </label>
              <input
                type="text"
                name="ulpin"
                value={searchParams.ulpin}
                onChange={handleChange}
                className={inputClass}
                placeholder={t('parcelSearch.ulpinPlaceholder')}
              />
            </div>
            <div>
              <label className={labelClass}>
                {t('parcelSearch.surveyNumberLabel')}
              </label>
              <input
                type="text"
                name="survey_number"
                value={searchParams.survey_number}
                onChange={handleChange}
                className={inputClass}
                placeholder={t('parcelSearch.surveyNumberPlaceholder')}
              />
            </div>
            <div>
              <label className={labelClass}>
                {t('parcelSearch.plotNumberLabel')}
              </label>
              <input
                type="text"
                name="plot_number"
                value={searchParams.plot_number}
                onChange={handleChange}
                className={inputClass}
                placeholder={t('parcelSearch.plotNumberPlaceholder')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelClass.replace('mb-1', '')}>
                  {t('parcelSearch.localIdentifierLabel')}
                </label>
                <MicButton
                  onResult={(text) => setSearchParams((prev) => ({ ...prev, local_identifier: text }))}
                />
              </div>
              <input
                type="text"
                name="local_identifier"
                value={searchParams.local_identifier}
                onChange={handleChange}
                className={inputClass}
                placeholder={t('parcelSearch.localIdentifierPlaceholder')}
              />
              {transliteratedText && (
                <p className="mt-1 text-xs text-brand-900 font-mono flex items-center gap-1 font-semibold">
                  <span>Searching as:</span>
                  <span className="font-bold underline">{transliteratedText}</span>
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>
                {t('parcelSearch.stateLabel')}
              </label>
              <select
                name="state"
                value={searchParams.state}
                onChange={handleStateChange}
                className={inputClass}
              >
                <option value="">-- All States --</option>
                {STATES_AND_DISTRICTS.map((st) => (
                  <option key={st.code} value={st.code}>
                    {st.name} ({st.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>
                {t('parcelSearch.districtLabel')}
              </label>
              <select
                name="district"
                value={searchParams.district}
                onChange={handleChange}
                disabled={!searchParams.state}
                className={`${inputClass} ${!searchParams.state ? 'opacity-60 cursor-not-allowed bg-surface-2' : ''}`}
              >
                <option value="">
                  {searchParams.state ? '-- All Districts --' : '-- Select State First --'}
                </option>
                {availableDistricts.map((dst) => (
                  <option key={dst.code} value={dst.code}>
                    {dst.name} ({dst.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
              {t('parcelSearch.searchButton')}
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchParams({
                  ulpin: '',
                  survey_number: '',
                  plot_number: '',
                  local_identifier: '',
                  state: '',
                  district: '',
                });
              }}
              className="inline-flex items-center gap-2 border-2 border-ink text-ink font-bold uppercase text-sm tracking-wider px-4 py-2 hover:bg-muted transition"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              {t('parcelSearch.resetButton')}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6">
        <h2 className="text-lg font-black uppercase tracking-tight font-display text-ink mb-4">{t('parcelSearch.resultsHeading', { count: searchResults?.length || 0 })}</h2>
        {isLoading ? (
          <div className="flex h-[300px] items-center justify-center text-ink/50 font-medium">{t('parcelSearch.loading')}</div>
        ) : error ? (
          <div className="flex h-[300px] items-center justify-center text-secondary-strong font-medium">{t('parcelSearch.errorLoading')}</div>
        ) : searchResults?.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-ink/50">
            {t('parcelSearch.noResults')}
          </div>
        ) : (
          <div className="space-y-0 divide-y-2 divide-ink/10 max-h-[300px] overflow-y-auto">
            {searchResults!.map((parcel) => (
              <div
                key={parcel.id}
                onClick={() => onSelectParcel?.(parcel.id)}
                className={`py-3 cursor-pointer px-2 transition ${
                  selectedParcelId === parcel.id ? 'bg-primary/10 border-l-4 border-primary' : 'hover:bg-muted'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-bold text-ink">
                      {parcel.id.substring(0, 8)}
                    </h3>
                    <p className="text-sm text-ink/60">
                      {parcel.ulpin ? `${t('parcelSearch.ulpinLabel')}: ${parcel.ulpin}` : t('parcelSearch.noUlpin')}
                    </p>
                    <p className="text-sm text-ink/60">
                      {parcel.stateCode}-{parcel.districtCode}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-primary">
                      {parcel.areaSqM.toLocaleString()} m²
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/parcels/${parcel.id}`);
                      }}
                      className="mt-1 px-2.5 py-1 bg-primary text-white text-xs font-bold uppercase tracking-wide border-2 border-ink hover:bg-primary-strong transition"
                    >
                      {t('parcelSearch.viewButton')}
                    </button>
                    {renderResultAction && <div className="mt-1.5">{renderResultAction(parcel)}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ParcelSearch;
