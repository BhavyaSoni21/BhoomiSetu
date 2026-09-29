import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, CheckCircle2, AlertCircle, MapPin, ArrowRight, Loader2 } from 'lucide-react';
import apiService from '../../services/apiService';
import { ParcelSummary } from '../../types/parcel';
import { useTranslation } from '../../context/LanguageContext';

interface ParcelSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Real search, not sample/demo data - GET /parcels only matches one
// identifier field at a time (exact match, backend/src/parcels/parcels.service.ts
// searchParcels), so a single free-text box tries ulpin first, then falls
// back to survey_number, matching what a citizen is actually likely to have
// on hand (same two identifier types ParcelSearch.tsx's own form exposes).
async function searchByAnyIdentifier(term: string): Promise<ParcelSummary[]> {
  const byUlpin = await apiService.get('/parcels', { params: { ulpin: term } });
  if (byUlpin.data.parcels.length > 0) return byUlpin.data.parcels;
  const bySurvey = await apiService.get('/parcels', { params: { survey_number: term } });
  return bySurvey.data.parcels;
}

export const ParcelSearchModal: React.FC<ParcelSearchModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<ParcelSummary[]>([]);
  const [selectedResult, setSelectedResult] = useState<ParcelSummary | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchTerm.trim();
    if (!query) return;
    setIsSearching(true);
    setSearched(true);
    setSearchError(null);
    try {
      const found = await searchByAnyIdentifier(query);
      setResults(found);
      setSelectedResult(found[0] ?? null);
    } catch (error) {
      setResults([]);
      setSelectedResult(null);
      setSearchError(
        error instanceof Error && error.message
          ? error.message
          : 'Parcel search is temporarily unavailable. Please try again.',
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (parcel: ParcelSummary) => {
    setSelectedResult(parcel);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-[#122b20] rounded-2xl shadow-2xl border border-black/10 dark:border-white/15 overflow-hidden font-sans"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-headline"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0F3D2E] text-white border-b border-white/15">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-white/10">
              <Search className="w-5 h-5 text-[#F59E0B]" />
            </div>
            <div>
              <h3 id="modal-headline" className="font-heading font-bold text-base sm:text-lg text-white">
                {t('landing.searchModal.title')}
              </h3>
              <p className="text-xs text-white/70">{t('landing.searchModal.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('landing.searchModal.closeAriaLabel')}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Search Input Form */}
          <form onSubmit={handleSearch} className="space-y-2">
            <label htmlFor="parcel-input" className="block text-xs font-semibold uppercase tracking-wider text-[#53635A] dark:text-white/70">
              {t('landing.searchModal.inputLabel')}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="parcel-input"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('landing.searchModal.inputPlaceholder')}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-white/20 bg-white dark:bg-black/30 font-mono text-sm text-[#0F3D2E] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534] dark:focus:ring-[#F59E0B]"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchTerm.trim()}
                className="px-5 py-3 rounded-xl bg-[#0F3D2E] hover:bg-[#166534] text-white font-heading font-bold text-sm transition shadow-sm disabled:opacity-50"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : t('landing.searchModal.searchButton')}
              </button>
            </div>
          </form>

          {searchError && !isSearching && (
            <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 flex items-start justify-between gap-3 text-sm text-red-900 dark:text-red-200" role="alert">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{searchError}</span>
              </div>
              <button type="button" onClick={() => void handleSearch({ preventDefault: () => {} } as React.FormEvent)} disabled={!searchTerm.trim()} className="shrink-0 font-semibold underline underline-offset-2 disabled:opacity-50">
                Retry
              </button>
            </div>
          )}

          {/* Multiple matches - pick one */}
          {results.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground text-[#718078] dark:text-white/60">{t('landing.searchModal.matchesCount', { count: results.length })}</span>
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectResult(p)}
                  className={`px-2.5 py-1 rounded-lg border font-mono transition text-[11px] ${
                    selectedResult?.id === p.id
                      ? 'bg-[#0F3D2E] text-white border-[#0F3D2E]'
                      : 'bg-gray-100 dark:bg-white/10 text-[#34413A] dark:text-white/90 border-transparent hover:border-gray-300'
                  }`}
                >
                  {p.ulpin ?? `#${p.id.substring(0, 8)}`}
                </button>
              ))}
            </div>
          )}

          {/* No matches */}
          {searched && !isSearching && results.length === 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 flex items-start gap-2.5 text-sm text-amber-900 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{t('landing.searchModal.noMatch', { term: searchTerm })}</span>
            </div>
          )}

          {/* Search Result Card */}
          {selectedResult && (
            <div className="rounded-xl border border-gray-200 dark:border-white/15 bg-[#F7FAF5] dark:bg-[#163628] p-4.5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#53635A] dark:text-white/60">ULPIN</span>
                    <span className="font-mono font-bold text-sm sm:text-base text-[#0F3D2E] dark:text-white">
                      {selectedResult.ulpin ?? `#${selectedResult.id.substring(0, 8)}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-[#53635A] dark:text-white/70">
                    <MapPin className="w-3.5 h-3.5 text-[#D97706]" />
                    <span>{selectedResult.stateCode}-{selectedResult.districtCode}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#166534]/15 text-[#166534] dark:bg-[#166534]/40 dark:text-emerald-300 border border-[#166534]/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t('landing.searchModal.onRecordBadge')}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-black/10 dark:border-white/10 text-xs">
                <div>
                  <span className="text-[#718078] dark:text-white/60 block text-[10px] uppercase font-semibold">{t('landing.searchModal.extentLabel')}</span>
                  <span className="font-mono font-bold text-[#34413A] dark:text-white">{selectedResult.areaSqM.toLocaleString()} m²</span>
                </div>
                <div>
                  <span className="text-[#718078] dark:text-white/60 block text-[10px] uppercase font-semibold">{t('landing.searchModal.parcelIdLabel')}</span>
                  <span className="font-mono font-bold text-[#34413A] dark:text-white">#{selectedResult.id.substring(0, 8)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/parcels/${selectedResult.id}`);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F3D2E] hover:bg-[#166534] text-white text-xs font-semibold transition"
                >
                  <span>{t('landing.searchModal.viewProfileCta')}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-black/20 border-t border-black/10 dark:border-white/10 flex items-center justify-between text-xs text-[#718078] dark:text-white/60">
          <span>Digital India Land Records Modernization Programme (DILRMP)</span>
          <button
            onClick={onClose}
            className="text-xs font-medium hover:underline text-[#34413A] dark:text-white"
          >
            {t('landing.searchModal.closeButton')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParcelSearchModal;
