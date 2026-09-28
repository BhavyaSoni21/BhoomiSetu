import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

interface QueryErrorProps {
  /** Optional react-query refetch; when provided a Retry button is shown. */
  onRetry?: () => void;
  /** Override the default message. */
  message?: string;
  className?: string;
}

// Shared "the fetch failed" state so a failed query is never mistaken for an
// empty list. Pass a query's `refetch` as onRetry to offer a retry.
const QueryError: React.FC<QueryErrorProps> = ({ onRetry, message, className }) => {
  const { t } = useTranslation();
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-10 text-center ${className ?? ''}`}>
      <AlertTriangle className="w-8 h-8 text-error" />
      <p className="text-sm text-text-secondary">
        {message ?? t('common.loadError', 'Unable to load. Please try again.')}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-ink bg-surface-2 hover:bg-surface-2/70 border border-gov-border transition"
        >
          <RotateCw className="w-3.5 h-3.5" />
          {t('common.retry', 'Retry')}
        </button>
      )}
    </div>
  );
};

export default QueryError;
