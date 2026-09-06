import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import apiService from '../../services/apiService';
import { useAuthUser, useLogout } from '../auth/auth';
import { ParcelSummary } from '../../types/parcel';

// Optional citizen sign-in (docs/Plan.md Phase 12): shows the parcels linked
// to the signed-in citizen's account. Signing in is never required to use
// the rest of the Citizen Portal (search/service-requests stay anonymous) -
// this panel is the one place that actually depends on an account existing.
const MyParcels: React.FC = () => {
  const { data: user, isLoading: userLoading } = useAuthUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const isCitizen = user?.role === 'CITIZEN';

  const { data, isLoading, error } = useQuery<{ parcels: ParcelSummary[]; total: number }>(
    ['my-parcels'],
    async () => (await apiService.get('/parcels/mine')).data,
    { enabled: isCitizen },
  );

  if (userLoading) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-semibold">My Parcels</h2>
        {isCitizen && (
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700 hover:underline">
            Sign out
          </button>
        )}
      </div>

      {!isCitizen ? (
        <p className="text-sm text-gray-500">
          <Link to="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>{' '}
          to see the parcels linked to your account. An account is never required to search or use the rest of this
          portal.
        </p>
      ) : isLoading ? (
        <p className="text-sm text-gray-500">Loading your parcels...</p>
      ) : error ? (
        <p className="text-sm text-red-600">Something went wrong loading your parcels.</p>
      ) : data!.total === 0 ? (
        <p className="text-sm text-gray-500">
          Signed in as {user!.name}. No parcels are linked to your account yet.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Signed in as {user!.name} — {data!.total} parcel{data!.total === 1 ? '' : 's'} linked to your account.
          </p>
          {data!.parcels.map((parcel) => (
            <div key={parcel.id} className="border-b py-3 last:border-b-0">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-gray-800">Parcel #{parcel.id.substring(0, 8)}...</h3>
                  <p className="text-sm text-gray-600">{parcel.ulpin ? `ULPIN: ${parcel.ulpin}` : 'No ULPIN'}</p>
                  <p className="text-sm text-gray-600">
                    {parcel.stateCode}-{parcel.districtCode}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-blue-600">{parcel.areaSqM.toLocaleString()} m²</p>
                  <button
                    onClick={() => navigate(`/parcels/${parcel.id}`)}
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
  );
};

export default MyParcels;
