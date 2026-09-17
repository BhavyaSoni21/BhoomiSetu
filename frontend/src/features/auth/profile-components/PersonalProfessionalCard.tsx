import React from 'react';
import { User, Briefcase, Shield } from 'lucide-react';
import { AuthUser } from '../auth';
import { ProfileCard } from './ProfileCard';
import { StatusPill } from './StatusPill';

interface PersonalProfessionalCardProps {
  user?: AuthUser;
  mode?: 'citizen' | 'officer' | 'admin';
  onEdit?: () => void;
}

export const PersonalProfessionalCard: React.FC<PersonalProfessionalCardProps> = ({
  user,
  mode = 'citizen',
  onEdit,
}) => {
  const isCitizen = mode === 'citizen';
  const isOfficer = mode === 'officer';
  const isAdmin = mode === 'admin';

  const name = user?.name || (isCitizen ? 'Amit Kumar' : isOfficer ? 'Asha Kulkarni' : 'Rajesh Sharma');
  const preferredName = user?.name ? user.name.split(' ')[0] : isCitizen ? 'Amit' : isOfficer ? 'Asha' : 'Rajesh';
  const designation = isOfficer ? 'Senior Land Records Officer' : isAdmin ? 'System Administrator' : 'Citizen';
  const department = isOfficer ? 'Land Records' : isAdmin ? 'Land Records (State)' : 'Public Sector';
  const idNumber = isOfficer
    ? user?.governmentIdNumber
      ? `LRM******${user.governmentIdNumber.slice(-4)}`
      : 'LRM******3421'
    : isAdmin
    ? user?.governmentIdNumber
      ? `ADM******${user.governmentIdNumber.slice(-4)}`
      : 'ADM******9087'
    : '•••• •••• 4821';
  const joiningDate = isOfficer ? '12 Jun 2015' : isAdmin ? '10 Jan 2021' : '11 Sep 2026';
  const officeLocation = isOfficer ? 'Collectorate, Pune' : isAdmin ? 'Secretariat, New Delhi' : 'Not provided';
  const preferredLang = 'English, Marathi';

  const title = isCitizen
    ? 'PERSONAL INFORMATION'
    : isOfficer
    ? 'PROFESSIONAL INFORMATION'
    : 'ADMINISTRATIVE INFORMATION';

  const Icon = isCitizen ? User : isOfficer ? Briefcase : Shield;

  return (
    <ProfileCard
      icon={<Icon className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />}
      title={title}
    >
      <div className="space-y-3">
        {/* Row: Full name */}
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
          <span className="text-xs text-text-muted font-medium">Full name</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-heading">{name}</span>
            <StatusPill status="verified" size="sm" />
          </div>
        </div>

        {isCitizen && (
          <>
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
              <span className="text-xs text-text-muted font-medium">Preferred name</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-heading">{preferredName}</span>
                <StatusPill status="user-provided" size="sm" />
              </div>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
              <span className="text-xs text-text-muted font-medium">Date of birth</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-heading">•••• •• 1990</span>
                <StatusPill status="user-provided" size="sm" />
              </div>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
              <span className="text-xs text-text-muted font-medium">Gender</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-heading">Male</span>
                <StatusPill status="user-provided" size="sm" />
              </div>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
              <span className="text-xs text-text-muted font-medium">Residential address</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-secondary">{user?.address || 'Not provided'}</span>
                <StatusPill status={user?.address ? 'verified' : 'not-provided'} size="sm" />
              </div>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
              <span className="text-xs text-text-muted font-medium">Occupation</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-heading">{user?.occupation || 'Private Sector'}</span>
                <StatusPill status="user-provided" size="sm" />
              </div>
            </div>
          </>
        )}

        {(isOfficer || isAdmin) && (
          <>
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
              <span className="text-xs text-text-muted font-medium">Designation</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-heading">{designation}</span>
                <StatusPill status="verified" size="sm" />
              </div>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
              <span className="text-xs text-text-muted font-medium">Department</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-heading">{department}</span>
                <StatusPill status="verified" size="sm" />
              </div>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
              <span className="text-xs text-text-muted font-medium">{isOfficer ? 'Employee ID' : 'Admin ID'}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-text-heading">{idNumber}</span>
                <StatusPill status="verified" size="sm" />
              </div>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
              <span className="text-xs text-text-muted font-medium">Joining date</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-heading">{joiningDate}</span>
                <StatusPill status="verified" size="sm" />
              </div>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
              <span className="text-xs text-text-muted font-medium">Employment status</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-heading">Regular (Government)</span>
                <StatusPill status="verified" size="sm" />
              </div>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
              <span className="text-xs text-text-muted font-medium">Office location</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-heading">{officeLocation}</span>
                <StatusPill status="verified" size="sm" />
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-between py-1.5">
          <span className="text-xs text-text-muted font-medium">Preferred language</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-heading">{preferredLang}</span>
            <StatusPill status={isCitizen ? 'verified' : 'user-provided'} size="sm" />
          </div>
        </div>
      </div>
    </ProfileCard>
  );
};

export default PersonalProfessionalCard;