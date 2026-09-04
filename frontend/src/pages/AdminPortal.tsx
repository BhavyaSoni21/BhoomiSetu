import React from 'react';

const AdminPortal: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Portal</h1>
      <p className="mb-4">Welcome, Administrator! This portal is for system administration, user management, and configuration.</p>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">System Overview</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Total Users</h3>
            <p className="text-lg font-bold">0</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Active Sessions</h3>
            <p className="text-lg font-bold">0</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">System Status</h3>
            <p className="text-lg font-bold">Online</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Last Backup</h3>
            <p className="text-lg font-bold">Never</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;