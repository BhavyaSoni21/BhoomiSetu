import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthUser, UserRole } from './auth';
import { useTranslation } from '../../context/LanguageContext';

interface RequireAuthProps {
  roles: UserRole[];
  children: React.ReactElement;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ roles, children }) => {
  const { data: user, isLoading } = useAuthUser();
  const { t } = useTranslation();

  if (isLoading) {
    return <div className="flex h-[400px] items-center justify-center text-gray-500 text-sm">{t('requireAuth.checkingSession')}</div>;
  }
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export default RequireAuth;
