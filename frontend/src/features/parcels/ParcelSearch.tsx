import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/apiService';
import { ParcelSummary } from '../../types/parcel';

interface ParcelSearchProps {
  onResultsChange?: (parcels: ParcelSummary[]) => void;
  selectedParcelId?: string | null;
  onSelectParcel?: (parcelId: string) => void;
}

const ParcelSearch: React.FC<ParcelSearchProps> = ({ onResultsChange, selectedParcelId, onSelectParcel }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    ulpin: '',
    survey_number: '',
    plot_number: '',
    local_identifier: '',
    state: '',
    district: '',
  });

  const { data: searchResults, isLoading, error } = useQuery<ParcelSummary[]>(
    ['parcels', searchParams],
    async () => {
      // Filter out empty params
      const params = Object.entries(searchParams)
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSearchParams(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Search results already update live as searchParams changes; nothing to trigger here.
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Search Parcels</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ULPIN
              </label>
              <input
                type="text"
                name="ulpin"
                value={searchParams.ulpin}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter ULPIN"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Survey Number
              </label>
              <input
                type="text"
                name="survey_number"
                value={searchParams.survey_number}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter Survey Number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plot Number
              </label>
              <input
                type="text"
                name="plot_number"
                value={searchParams.plot_number}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter Plot Number"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Local Identifier
              </label>
              <input
                type="text"
                name="local_identifier"
                value={searchParams.local_identifier}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter Local Identifier"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <input
                type="text"
                name="state"
                value={searchParams.state}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter State Code"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                District
              </label>
              <input
                type="text"
                name="district"
                value={searchParams.district}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter District Code"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Search
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
              className="ml-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Search Results ({searchResults?.length || 0} parcels)</h2>
        {isLoading ? (
          <div className="flex h-[300px] items-center justify-center">Loading results...</div>
        ) : error ? (
          <div className="flex h-[300px] items-center justify-center">Error loading results</div>
        ) : searchResults?.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-gray-500">
            No parcels found matching your criteria
          </div>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {searchResults!.map((parcel) => (
              <div
                key={parcel.id}
                onClick={() => onSelectParcel?.(parcel.id)}
                className={`border-b py-3 last:border-b-0 cursor-pointer rounded px-2 ${
                  selectedParcelId === parcel.id ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-800">
                      Parcel #{parcel.id.substring(0, 8)}...
                    </h3>
                    <p className="text-sm text-gray-600">
                      {parcel.ulpin ? `ULPIN: ${parcel.ulpin}` : 'No ULPIN'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {parcel.stateCode}-{parcel.districtCode}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-blue-600">
                      {parcel.areaSqM.toLocaleString()} m²
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/parcels/${parcel.id}`);
                      }}
                      className="mt-1 px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                    >
                      View
                    </button>
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
