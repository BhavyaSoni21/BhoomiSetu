import React, { useState } from 'react';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Simulate API call
    try {
      // In a real app, this would be an API call to your auth service
      console.log('Logging in with:', { email, password, rememberMe });

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // For demo purposes, redirect to citizen portal
      window.location.href = '/citizen';
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="text-center text-2xl font-bold">
            Sign in to your account
          </h2>
          <p className="text-center text-sm text-gray-600">
            Or <a href="#" className="font-medium text-primary hover:underline">
              continue with Google
            </a>
          </p>
        </div>
        <form className="h-[400px] space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus-primary sm:text-sm sm:leading-6"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <div className="text-sm">
                <a href="#" className="font-medium text-primary hover:underline">
                  Forgot password?
                </a>
              </div>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus-primary sm:text-sm sm:leading-6"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex items-center h-5">
            <input
              id="remember-me"
              type="checkbox"
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <label htmlFor="remember-me" className="ml-2 text-sm text-gray-600">
              Remember me
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="terms"
                type="checkbox"
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="terms" className="ml-2 text-sm text-gray-600">
                I agree to the
                <a href="#" className="font-medium text-primary hover:underline">
                  Terms of Use
                </a>
              </label>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/80 focus:outline-none focus:ring-2 focus-ring-primary focus:ring-offset-2 disabled:opacity-50 transition ease-in-out duration-200"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <p className="text-center text-sm text-gray-500">
            Don’t have an account?
            <a href="#" className="font-medium text-primary hover:underline">
              Sign up
            </a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;