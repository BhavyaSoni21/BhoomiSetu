import React from 'react';
import MyParcels from '../../features/citizen/MyParcels';
import BackButton from '../../components/BackButton';

const MyParcelsPage: React.FC = () => (
  <div className="max-w-3xl space-y-3">
    <BackButton variant="ink" />
    <MyParcels />
  </div>
);

export default MyParcelsPage;
