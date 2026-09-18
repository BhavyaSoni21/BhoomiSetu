import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { useQueryClient } from '@tanstack/react-query';
import apiService from '../services/apiService';

const TOKEN_KEY = 'access_token';

const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const hasFired = useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  useEffect(() => {
    // StrictMode fires effects twice — the ref ensures we only run once.
    if (hasFired.current) return;
    hasFired.current = true;

    if (error) {
      console.error('Google OAuth error:', error, errorDescription);
      navigate('/login', {
        state: { oauthError: errorDescription || 'Google sign-in was cancelled or failed.' },
        replace: true,
      });
      return;
    }

    if (!code || !state) {
      navigate('/login', {
        state: { oauthError: 'Invalid OAuth callback: missing code or state.' },
        replace: true,
      });
      return;
    }

    // Directly call the API — no mutation state machine needed.
    (async () => {
      try {
        const response = await apiService.get('/auth/google/callback', {
          params: { code, state },
        });

        const { accessToken, user } = response.data;

        // Persist token
        localStorage.setItem(TOKEN_KEY, accessToken);

        // Seed the React Query cache so RequireAuth sees the user immediately
        queryClient.setQueryData(['auth-me'], user);

        // Navigate to the correct portal
        const dest =
          user.role === 'ADMIN' ? '/admin' :
          user.role === 'CITIZEN' ? '/citizen' : '/officer';

        navigate(dest, { replace: true });
      } catch (err: unknown) {
        console.error('Google OAuth callback failed:', err);
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Sign-in failed. Please try again.';
        setErrorMsg(msg);
        setTimeout(() => {
          navigate('/login', {
            state: { oauthError: msg },
            replace: true,
          });
        }, 2000);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center px-4" style={{ background: 'var(--page-bg)' }}>
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center animate-pulse" style={{ background: '#D1FAE5' }}>
            {errorMsg
              ? <AlertCircle className="w-8 h-8" style={{ color: '#991B1B' }} />
              : <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#065F46' }} />
            }
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="font-heading font-bold text-2xl" style={{ color: 'var(--text-heading)' }}>
            {errorMsg ? 'Sign-in Failed' : t('authPage.googleCompletingSignIn')}
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {errorMsg || t('authPage.googleCompletingSignInDesc')}
          </p>
        </div>
        {errorMsg && (
          <div
            role="alert"
            className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Redirecting you back to login…</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default OAuthCallbackPage;