import React from 'react';
import { AiExplanation } from '../../types/aiExplanation';

const RISK_COLORS: Record<string, string> = {
  LOW: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-red-100 text-red-700',
};

interface AiExplanationCardProps {
  explanation: AiExplanation;
}

const AiExplanationCard: React.FC<AiExplanationCardProps> = ({ explanation }) => (
  <div className="border border-indigo-100 rounded-lg p-4 bg-indigo-50 space-y-2">
    <div className="flex items-center justify-between">
      <h4 className="font-semibold text-sm text-indigo-900">AI Explanation</h4>
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${RISK_COLORS[explanation.risk_level] ?? 'bg-gray-100 text-gray-700'}`}>
        {explanation.risk_level} RISK
      </span>
    </div>
    <p className="text-sm text-gray-700">{explanation.summary}</p>
    {explanation.findings.length > 0 && (
      <ul className="space-y-1 list-disc list-inside">
        {explanation.findings.map((finding, index) => (
          <li key={index} className="text-xs text-gray-600">
            <strong>{finding.type}:</strong> {finding.description}
          </li>
        ))}
      </ul>
    )}
    <p className="text-xs text-gray-500 italic">Recommended: {explanation.recommended_action}</p>
  </div>
);

export default AiExplanationCard;
