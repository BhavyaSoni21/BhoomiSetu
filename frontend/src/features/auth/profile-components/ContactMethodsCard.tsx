import React, { useState } from 'react';
import { Phone, Mail, MapPin, Bell } from 'lucide-react';
import { AuthUser } from '../auth';
import { ProfileCard } from './ProfileCard';
import { StatusPill } from './StatusPill';

interface ContactMethodsCardProps {
  user?: AuthUser;
  mode?: 'officer' | 'admin';
}

export const ContactMethodsCard: React.FC<ContactMethodsCardProps> = ({
  user,
  mode = 'officer',
}) => {
  const isOfficer = mode === 'officer';
  const defaultEmail = isOfficer
    ? 'asha.kulkarni@maharashtra.gov.in'
    : 'rajesh.sharma@nic.in';
  const email = user?.email || defaultEmail;

  const defaultMobile = isOfficer ? null : '+91 98100 11223';
  const mobile = user?.mobileNumber || defaultMobile;

  const officePhone = isOfficer ? '020-2612-3456' : '011-2309-1111';
  const officeAddress = isOfficer
    ? 'District Collectorate, Shivajinagar, Pune - 411005'
    : 'Ministry of Panchayati Raj, New Delhi - 110001';

  const [smsEnabled, setSmsEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);

  return (
    <ProfileCard
      icon={<Phone className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />}
      title={isOfficer ? 'CONTACT METHODS & NOTIFICATIONS' : 'CONTACT & NOTIFICATIONS'}
    >
      <div className="space-y-3">
        {/* Official Email */}
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
          <span className="text-xs text-text-muted font-medium">Official email</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-heading truncate max-w-[150px] sm:max-w-[200px]">{email}</span>
            <StatusPill status="verified" size="sm" />
          </div>
        </div>

        {/* Mobile Number */}
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
          <span className="text-xs text-text-muted font-medium">Mobile number</span>
          <div className="flex items-center gap-2">
            {mobile ? (
              <>
                <span className="text-xs font-mono font-medium text-text-heading">{mobile}</span>
                <StatusPill status="verified" size="sm" />
              </>
            ) : (
              <>
                <span className="text-xs font-medium text-text-muted">Not provided</span>
                <button
                  type="button"
                  aria-label="Add official mobile"
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition"
                >
                  + Add
                </button>
              </>
            )}
          </div>
        </div>

        {/* Office Phone */}
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
          <span className="text-xs text-text-muted font-medium">Office phone</span>
          <span className="text-xs font-mono font-medium text-text-heading">{officePhone}</span>
        </div>

        {/* Office Address */}
        <div className="py-1.5 border-b border-gray-100 dark:border-gray-800/60">
          <span className="text-xs text-text-muted font-medium block">Office address</span>
          <p className="text-xs font-medium text-text-heading mt-0.5 leading-relaxed">{officeAddress}</p>
        </div>

        {/* Preferred Contact */}
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
          <span className="text-xs text-text-muted font-medium">Preferred contact</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-heading">Email</span>
            <button
              type="button"
              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 hover:underline"
            >
              Change
            </button>
          </div>
        </div>

        {/* Notification Toggles */}
        <div className="pt-2 space-y-2.5">
          <span className="text-xs font-bold text-text-heading block">Notification Channels</span>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">SMS notifications</span>
            <button
              type="button"
              onClick={() => setSmsEnabled(!smsEnabled)}
              className={`w-9 h-5 rounded-full transition-colors relative ${smsEnabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'}`}
              aria-label="Toggle SMS notifications"
            >
              <span className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-transform ${smsEnabled ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">Email notifications</span>
            <button
              type="button"
              onClick={() => setEmailEnabled(!emailEnabled)}
              className={`w-9 h-5 rounded-full transition-colors relative ${emailEnabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'}`}
              aria-label="Toggle email notifications"
            >
              <span className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-transform ${emailEnabled ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">In-app notifications</span>
            <button
              type="button"
              onClick={() => setInAppEnabled(!inAppEnabled)}
              className={`w-9 h-5 rounded-full transition-colors relative ${inAppEnabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'}`}
              aria-label="Toggle in-app notifications"
            >
              <span className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-transform ${inAppEnabled ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
        </div>
      </div>
    </ProfileCard>
  );
};

export default ContactMethodsCard;