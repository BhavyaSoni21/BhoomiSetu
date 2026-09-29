import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthUser, UserRole } from './auth';
import { useTranslation } from '../../context/LanguageContext';

interface RequireAuthProps {
  roles: UserRole[];
  children: React.ReactElement;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ roles, children }) => {
  const { data: user, isLoading, isError } = useAuthUser();
  const { t } = useTranslation();

  // A token present but /auth/me not yet resolved (undefined) means the backend
  // hasn't confirmed the session - on a cold Render free-tier instance that wake
  // takes 30-60s. Show "reconnecting" and let useAuthUser keep polling; do NOT
  // bounce a signed-in user to /login just because the wake request timed out
  // (that was the "Google login not retained on refresh" bug). A real 401
  // clears the token, so user becomes null (not undefined) and we redirect below.
  let hasToken = false;
  try { hasToken = !!localStorage.getItem('access_token'); } catch { /* private mode */ }

  if (isLoading || (hasToken && user === undefined)) {
    return (
      <div className="flex h-[400px] items-center justify-center text-gray-500 text-sm">
        {isError ? t('requireAuth.reconnecting', 'Reconnecting to server…') : t('requireAuth.checkingSession')}
      </div>
    );
  }
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export default RequireAuth;
