import React from 'react';

const OfficerPortal: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Officer Portal</h1>
      <p className="mb-4">Welcome, Officer! This portal is for government officials to manage workflows, verify documents, and handle governance alerts.</p>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Dashboard Overview</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Pending Workflows</h3>
            <p className="text-lg font-bold">0</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Verified Today</h3>
            <p className="text-lg font-bold">0</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Alerts Requiring Attention</h3>
            <p className="text-lg font-bold">0</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Documents Processed</h3>
            <p className="text-lg font-bold">0</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfficerPortal;