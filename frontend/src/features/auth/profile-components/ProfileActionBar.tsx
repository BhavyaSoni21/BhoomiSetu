import React from 'react';
import { Info, Edit3, Save, X, Download, HelpCircle } from 'lucide-react';

interface ProfileActionBarProps {
  infoMessage?: string;
  isEditing?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  onDownloadSummary?: () => void;
  onContactSupport?: () => void;
}

export const ProfileActionBar: React.FC<ProfileActionBarProps> = ({
  infoMessage = 'Your profile information helps BhoomiSetu provide better services and securely manage your land records.',
  isEditing = false,
  onEdit,
  onSave,
  onCancel,
  onDownloadSummary,
  onContactSupport,
}) => {
  return (
    <div className="w-full space-y-4 pt-4">
      {/* Informational Banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200">
        <Info className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden="true" />
        <span className="font-medium">{infoMessage}</span>
      </div>

      {/* Button Row */}
      <div className="flex flex-wrap items-center gap-3">
        {!isEditing ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F3D2E] hover:bg-[#166534] text-white text-xs font-bold uppercase tracking-wider shadow-sm transition"
          >
            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Edit Profile</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onSave}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F3D2E] hover:bg-[#166534] text-white text-xs font-bold uppercase tracking-wider shadow-sm transition"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Save Changes</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white dark:bg-surface-1 hover:bg-gray-50 dark:hover:bg-surface-2 text-text-heading text-xs font-bold uppercase tracking-wider shadow-2xs transition"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Cancel</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onDownloadSummary}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white dark:bg-surface-1 hover:bg-gray-50 dark:hover:bg-surface-2 text-text-heading text-xs font-bold uppercase tracking-wider shadow-2xs transition"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Download Profile Summary</span>
        </button>

        <button
          type="button"
          onClick={onContactSupport}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white dark:bg-surface-1 hover:bg-gray-50 dark:hover:bg-surface-2 text-text-heading text-xs font-bold uppercase tracking-wider shadow-2xs transition"
        >
          <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Contact Support</span>
        </button>
      </div>
    </div>
  );
};

export default ProfileActionBar;