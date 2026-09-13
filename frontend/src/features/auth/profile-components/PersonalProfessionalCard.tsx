import React from 'react';
import { Briefcase, MapPin, Calendar, Building } from 'lucide-react';
import { ProfileField } from './ProfileField';
import { AuthUser } from '../auth';
import { OfficerRole } from '../../officer/officerAuth';

function employeeIdMask(value: string): string {
  if (!value) return 'LRM******3421';
  const visible = value.slice(-4);
  const prefix = value.slice(0, 3).toUpperCase();
  return prefix + '******' + visible;
}

interface PersonalProfessionalCardProps {
  user?: AuthUser;
  children?: React.ReactNode;
}

const PersonalProfessionalCard: React.FC<PersonalProfessionalCardProps> = ({ user, children }) => {
  const name = user?.name ?? 'Asha Kulkarni';
  const preferredName = name.split(/\s+/)[0];
  // roleKey kept for potential future role-specific label display
  const _roleKey = user?.role as OfficerRole;
  const designation = 'Senior Land Records Officer';
  const department = 'Land Records';
  const employeeId = user?.governmentIdNumber ? employeeIdMask(user.governmentIdNumber) : 'LRM******3421';
  const officeLocation = 'Collectorate, Pune';

  return (
    <div className="bg-surface border-2 border-ink shadow-hard-md overflow-hidden">
      <div className="border-b-2 border-ink/20 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink">Personal &amp; Professional Information</h3>
        </div>
      </div>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-primary" aria-hidden="true" />
              <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50">Personal Details</h4>
            </div>
            <ProfileField label="Full name" value={name} />
            <ProfileField label="Preferred name" value={preferredName} />
            <ProfileField label="Date of birth" value="•••• •• 1988" />
            <ProfileField label="Gender" value="Female" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building className="w-4 h-4 text-primary" aria-hidden="true" />
              <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50">Professional Details</h4>
            </div>
            <ProfileField label="Designation" value={designation} />
            <ProfileField label="Department" value={department} />
            <ProfileField label="Employee / Officer ID" value={employeeId} />
            <ProfileField label="Joining date" value="12 Jun 2015" />
            <ProfileField label="Employment status" value="Regular (Government)" />
          </div>
        </div>

        <div className="border-t border-ink/20 pt-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-primary" aria-hidden="true" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50">Additional Information</h4>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <ProfileField label="Preferred language" value="English, Marathi" />
              <ProfileField label="Official office location" value={officeLocation} />
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
};

export default PersonalProfessionalCard;