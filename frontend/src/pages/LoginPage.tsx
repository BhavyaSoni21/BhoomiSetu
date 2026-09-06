import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useLogin } from '../features/auth/auth';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const user = await loginMutation.mutateAsync({ email, password });
      navigate(user.role === 'ADMIN' ? '/admin' : user.role === 'CITIZEN' ? '/citizen' : '/officer');
    } catch (err) {
      setError(
        axios.isAxiosError(err) && err.response?.status === 401
          ? 'Invalid email or password.'
          : 'Something went wrong signing in. Please try again.',
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h2 className="text-center text-2xl font-bold">Sign In</h2>
          <p className="text-center text-sm text-gray-600 mt-1">
            Officers and admins sign in here for staff access. Citizens can browse and search the Citizen Portal with
            no account at all — sign in only if you want to see the parcels linked to your account.
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="block w-full rounded-md border border-gray-300 px-3.5 py-2 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
              placeholder="email@bhoomisetu.gov.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="block w-full rounded-md border border-gray-300 px-3.5 py-2 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loginMutation.isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loginMutation.isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-800">
          <p className="font-medium mb-1">Demo accounts (password: Demo@123)</p>
          <ul className="space-y-0.5">
            <li>admin@bhoomisetu.gov.in — Admin</li>
            <li>landrecords.officer@bhoomisetu.gov.in — Land Record Officer</li>
            <li>registration.officer@bhoomisetu.gov.in — Registration Officer</li>
            <li>planning.officer@bhoomisetu.gov.in — Planning Officer</li>
            <li>dispute.officer@bhoomisetu.gov.in — Dispute Officer</li>
            <li>citizen1@example.com through citizen20@example.com — Citizen</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
