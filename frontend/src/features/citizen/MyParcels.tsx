import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, MapPin, UserCircle2 } from 'lucide-react';
import apiService from '../../services/apiService';
import { useAuthUser, useLogout } from '../auth/auth';
import { ParcelSummary } from '../../types/parcel';

// Optional citizen sign-in (docs/Plan.md Phase 12): shows the parcels linked
// to the signed-in citizen's account. Signing in is never required to use
// the rest of the Citizen Portal (search/service-requests stay anonymous) -
// this panel is the one place that actually depends on an account existing.
const MyParcels: React.FC = () => {
  const { t } = useTranslation();
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
    <div className="relative h-full bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6 hover:-translate-y-1 transition duration-200">
      <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-primary border-2 border-ink" aria-hidden="true" />
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-black uppercase tracking-tight font-display text-ink">My Parcels</h2>
        {isCitizen && (
          <div className="flex items-center gap-3">
            <Link
              to="/citizen/profile"
              className="inline-flex items-center gap-1.5 border-2 border-ink/25 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink/60 hover:text-primary hover:border-primary/50 transition"
            >
              <UserCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              {t('placeholders.profileTitle')}
            </Link>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink/60 hover:text-secondary transition"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              Sign out
            </button>
          </div>
        )}
      </div>

      {!isCitizen ? (
        <p className="text-sm text-ink/70 leading-relaxed">
          <Link to="/login" className="font-bold text-primary hover:text-primary-strong underline underline-offset-2">
            Sign in
          </Link>{' '}
          to see the parcels linked to your account. An account is never required to search or use the rest of this
          portal.
        </p>
      ) : isLoading ? (
        <p className="text-sm text-ink/60">Loading your parcels...</p>
      ) : error ? (
        <p className="text-sm font-medium text-secondary-strong">Something went wrong loading your parcels.</p>
      ) : data!.total === 0 ? (
        <p className="text-sm text-ink/70">
          Signed in as {user!.name}. No parcels are linked to your account yet.
        </p>
      ) : (
        <div className="space-y-0 divide-y-2 divide-ink/10">
          <p className="text-sm text-ink/70 pb-3">
            Signed in as {user!.name} — {data!.total} parcel{data!.total === 1 ? '' : 's'} linked to your account.
          </p>
          {data!.parcels.map((parcel) => (
            <div key={parcel.id} className="py-3">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h3 className="font-bold text-ink flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                    Parcel #{parcel.id.substring(0, 8)}...
                  </h3>
                  <p className="text-sm text-ink/60">{parcel.ulpin ? `ULPIN: ${parcel.ulpin}` : 'No ULPIN'}</p>
                  <p className="text-sm text-ink/60">
                    {parcel.stateCode}-{parcel.districtCode}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-primary">{parcel.areaSqM.toLocaleString()} m²</p>
                  <button
                    onClick={() => navigate(`/parcels/${parcel.id}`)}
                    className="mt-1 px-2.5 py-1 bg-primary text-white text-xs font-bold uppercase tracking-wide border-2 border-ink hover:bg-primary-strong transition"
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
