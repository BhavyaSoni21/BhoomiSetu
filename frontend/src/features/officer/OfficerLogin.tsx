import React, { useState } from 'react';
import { OFFICER_ROLES, OfficerRole, OfficerSession, ROLE_LABELS } from './officerAuth';

interface OfficerLoginProps {
  onLogin: (session: OfficerSession) => void;
}

const OfficerLogin: React.FC<OfficerLoginProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState<OfficerRole>(OFFICER_ROLES[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onLogin({ name: name.trim(), role });
  };

  return (
    <div className="mx-auto max-w-md bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-1">Officer Login</h2>
      <p className="text-sm text-gray-500 mb-4">
        Sign in with your name and department to review assigned workflows and governance alerts.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="officer-name" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            id="officer-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your name"
            required
          />
        </div>
        <div>
          <label htmlFor="officer-role" className="block text-sm font-medium text-gray-700 mb-1">
            Department / Role
          </label>
          <select
            id="officer-role"
            value={role}
            onChange={(e) => setRole(e.target.value as OfficerRole)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {OFFICER_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Sign In
        </button>
      </form>
    </div>
  );
};

export default OfficerLogin;
