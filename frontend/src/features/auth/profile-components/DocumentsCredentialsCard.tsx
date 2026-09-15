import React from 'react';
import { FileText, ExternalLink, Download, Edit } from 'lucide-react';
import { ProfileField } from './ProfileField';
import StatusBadge from './StatusBadge';
import { useTranslation } from '../../../context/LanguageContext';

interface DocumentItem {
  name: string;
  status: 'verified' | 'active' | 'pending';
  uploadDate: string;
}

const documents: DocumentItem[] = [
  { name: 'Government Employee ID', status: 'verified', uploadDate: '12 Jun 2015' },
  { name: 'Department Authorization Letter', status: 'verified', uploadDate: '12 Jun 2015' },
  { name: 'Role Assignment Document', status: 'verified', uploadDate: '15 Apr 2022' },
  { name: 'Digital Signature Certificate', status: 'active', uploadDate: '01 Mar 2026' },
  { name: 'GIS Training Certification', status: 'verified', uploadDate: '20 Feb 2026' },
];

interface DocumentsCredentialsCardProps {
  onDocumentAction?: (document: string, action: string) => void;
}

const DocumentsCredentialsCard: React.FC<DocumentsCredentialsCardProps> = ({ onDocumentAction }) => {
  const { t } = useTranslation();
  return (
    <div className="bg-surface border-2 border-ink shadow-hard-md overflow-hidden">
      <div className="border-b-2 border-ink/20 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink">{t('documentsCredentialsCard.heading')}</h3>
        </div>
        <button
          type="button"
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
        >
          <Edit className="w-3 h-3" aria-hidden="true" />
          {t('documentsCredentialsCard.uploadDocument')}
        </button>
      </div>
      <div className="p-6">
        <p className="text-sm text-ink/60 mb-4">
          {t('documentsCredentialsCard.description')}
        </p>
        <div className="space-y-3">
          {documents.map((doc) => (
            <div key={doc.name} className="border-2 border-ink/20 p-4 flex flex-wrap items-center gap-4">
              <FileText className="w-6 h-6 text-primary shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-[180px]">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-sm font-bold text-ink">{doc.name}</p>
                  <StatusBadge variant={doc.status}>{doc.status === 'verified' ? t('documentsCredentialsCard.verifiedCredential') : t('profileField.status.active')}</StatusBadge>
                </div>
                <p className="text-xs text-ink/50 mt-1">{t('documentsCredentialsCard.uploaded')}: {doc.uploadDate}</p>
              </div>
              <div className="flex items-center gap-2">
                {onDocumentAction && (
                  <button type="button" onClick={() => onDocumentAction(doc.name, 'View')} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition">
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    {t('documentsCredentialsCard.view')}
                  </button>
                )}
                {onDocumentAction && (
                  <button type="button" onClick={() => onDocumentAction(doc.name, 'Replace')} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition">
                    <Edit className="w-3 h-3" aria-hidden="true" />
                    {t('documentsCredentialsCard.replace')}
                  </button>
                )}
                {onDocumentAction && (
                  <button type="button" onClick={() => onDocumentAction(doc.name, 'Download')} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition">
                    <Download className="w-3 h-3" aria-hidden="true" />
                    {t('documentsCredentialsCard.download')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DocumentsCredentialsCard;