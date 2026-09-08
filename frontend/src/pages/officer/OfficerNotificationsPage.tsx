import React from 'react';
import { Bell } from 'lucide-react';
import ComingSoonCard from '../../features/officer/ComingSoonCard';

const OfficerNotificationsPage: React.FC = () => (
  <ComingSoonCard
    icon={Bell}
    title="Notifications"
    description="New request assigned, new documents submitted, department action on a shared request, and high-priority alert notifications - not built yet. Check Assigned Requests and Governance Alerts directly in the meantime."
  />
);

export default OfficerNotificationsPage;
