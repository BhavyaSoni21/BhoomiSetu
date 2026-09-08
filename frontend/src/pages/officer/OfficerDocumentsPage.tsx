import React from 'react';
import { FolderOpen } from 'lucide-react';
import ComingSoonCard from '../../features/officer/ComingSoonCard';

const OfficerDocumentsPage: React.FC = () => (
  <ComingSoonCard
    icon={FolderOpen}
    title="Documents"
    description="Documents submitted alongside a request, grouped by parcel and request, with inline review - not built yet. Review documents from within Assigned Requests / Parcel Verification in the meantime."
  />
);

export default OfficerDocumentsPage;
