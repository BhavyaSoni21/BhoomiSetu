import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { useGoogleCallback } from '../features/auth/auth';

const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const googleCallbackMutation = useGoogleCallback();

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const hasMutated = React.useRef(false);

  useEffect(() => {
    if (error) {
      // OAuth error from Google (user denied, invalid request, etc.)
      console.error('Google OAuth error:', error, errorDescription);
      navigate('/login', {
        state: {
          oauthError: errorDescription || t('authPage.googleOauthError'),
        },
        replace: true,
      });
      return;
    }

    if (code && state) {
      // Valid callback - exchange code for token
      if (!hasMutated.current) {
        hasMutated.current = true;
        googleCallbackMutation.mutate({ code, state }, {
          onSuccess: (user) => {
            const dest =
              user.role === 'ADMIN' ? '/admin' :
              user.role === 'CITIZEN' ? '/citizen' : '/officer';
            navigate(dest, { replace: true });
          },
          onError: (err) => {
            console.error('Google OAuth callback failed:', err);
            navigate('/login', {
              state: {
                oauthError: t('authPage.googleCallbackFailed'),
              },
              replace: true,
            });
          },
        });
      }
    } else {
      // Invalid callback - missing code or state
      navigate('/login', {
        state: {
          oauthError: t('authPage.invalidOauthCallback'),
        },
        replace: true,
      });
    }
  }, [code, state, error, errorDescription, navigate, t]);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center px-4" style={{ background: 'var(--page-bg)' }}>
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center animate-pulse" style={{ background: '#D1FAE5' }}>
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#065F46' }} />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="font-heading font-bold text-2xl" style={{ color: 'var(--text-heading)' }}>
            {t('authPage.googleCompletingSignIn')}
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('authPage.googleCompletingSignInDesc')}
          </p>
        </div>
        {googleCallbackMutation.isError && (
          <div
            role="alert"
            className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{t('authPage.googleCallbackError')}</span>
          </div>
        )}
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('authPage.redirecting')}
          <ExternalLink className="w-3 h-3 inline-block align-middle ml-1" aria-hidden="true" />
        </p>
      </div>
    </div>
  );
};

export default OAuthCallbackPage;