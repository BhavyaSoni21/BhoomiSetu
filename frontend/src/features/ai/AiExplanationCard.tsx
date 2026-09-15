import React from 'react';
import { Sparkles } from 'lucide-react';
import { AiExplanation } from '../../types/aiExplanation';
import { useTranslation } from '../../context/LanguageContext';

const RISK_COLORS: Record<string, string> = {
  LOW: 'bg-primary/10 text-primary border-primary/40',
  MEDIUM: 'bg-accent/20 text-secondary-strong border-accent/50',
  HIGH: 'bg-secondary/15 text-secondary-strong border-secondary/50',
};

interface AiExplanationCardProps {
  explanation: AiExplanation;
}

const AiExplanationCard: React.FC<AiExplanationCardProps> = ({ explanation }) => {
  const { t } = useTranslation();
  return (
    <div className="border-2 border-ink bg-muted p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-black uppercase tracking-wide text-xs text-ink flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
          {t('aiExplanationCard.heading')}
        </h4>
        <span className={`border-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${RISK_COLORS[explanation.risk_level] ?? 'bg-surface text-ink/60 border-ink/20'}`}>
          {explanation.risk_level} {t('aiExplanationCard.risk')}
        </span>
      </div>
      <p className="text-sm text-ink/80 leading-relaxed">{explanation.summary}</p>
      {explanation.findings.length > 0 && (
        <ul className="space-y-1 list-disc list-inside">
          {explanation.findings.map((finding, index) => (
            <li key={index} className="text-xs text-ink/60">
              <strong className="text-ink">{finding.type}:</strong> {finding.description}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink/50 italic">{t('aiExplanationCard.recommended')}: {explanation.recommended_action}</p>
    </div>
  );
};

export default AiExplanationCard;
