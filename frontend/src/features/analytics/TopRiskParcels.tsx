import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/apiService';
import { RiskScore } from '../../types/riskScore';

const RISK_BAND_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const TopRiskParcels: React.FC = () => {
  const navigate = useNavigate();

  const { data: parcels = [], isLoading, error } = useQuery<RiskScore[]>(['top-risk-parcels'], async () => {
    const response = await apiService.get('/predictive-analytics/top-risk-parcels', { params: { limit: 10 } });
    return response.data;
  });

  if (isLoading) return <div className="text-gray-500 text-sm">Loading risk scores...</div>;
  if (error) return <div className="text-gray-500 text-sm">Error loading risk scores</div>;
  if (parcels.length === 0) return <div className="text-gray-500 text-sm">No parcels to score yet.</div>;

  return (
    <div className="space-y-1">
      {parcels.map((parcel) => (
        <div key={parcel.parcelId} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-b-0 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-800">Parcel #{parcel.parcelId.substring(0, 8)}...</span>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${RISK_BAND_COLORS[parcel.riskBand] ?? 'bg-gray-100 text-gray-700'}`}>
              {parcel.riskBand} ({parcel.overallScore})
            </span>
          </div>
          <button
            onClick={() => navigate(`/parcels/${parcel.parcelId}`)}
            className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
          >
            View
          </button>
        </div>
      ))}
    </div>
  );
};

export default TopRiskParcels;
