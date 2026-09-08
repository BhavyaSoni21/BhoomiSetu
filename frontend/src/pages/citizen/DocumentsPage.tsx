import React from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen } from 'lucide-react';
import ComingSoonCard from '../../features/citizen/ComingSoonCard';

// Documents grouped by parcel, uploadable inline, run through OCR/verification
// (docs/FRONTEND_UPGRADE_SPEC.md §4) - distinct from the already-built,
// ad-hoc Verify Documents page: this is a persistent per-parcel document
// store, which doesn't exist yet (no WorkflowDocument persistence -
// docs/CITIZEN_FEATURES_UPGRADE_PLAN.md §3.2).
const DocumentsPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl">
      <ComingSoonCard
        icon={FolderOpen}
        title={t('placeholders.documentsTitle')}
        description={t('placeholders.documentsDesc')}
        accentClass="bg-primary"
      />
    </div>
  );
};

export default DocumentsPage;
