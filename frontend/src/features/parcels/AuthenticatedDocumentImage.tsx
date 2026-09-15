import React, { useEffect, useState } from 'react';
import apiService from '../../services/apiService';
import ImageLightbox from './ImageLightbox';
import { useTranslation } from '../../context/LanguageContext';

interface AuthenticatedDocumentImageProps {
  // API path to fetch the image from (e.g. `/parcels/:id/documents/:docId/file`
  // or `/workflows/:id/evidence`) - both are auth-gated, unlike a plain
  // <img src>, which can't carry the Authorization header apiService's
  // interceptor adds. Fetched as a blob and rendered via a local object URL
  // instead (revoked on unmount/change).
  src: string;
  alt: string;
  className?: string;
  // Click opens a full-screen zoom viewer (ImageLightbox), reusing the same
  // already-fetched object URL - no re-fetch (docs/FRONTEND_UPGRADE_SPEC.md
  // follow-up, "officer must be able to zoom to the papers").
  zoomable?: boolean;
}

const AuthenticatedDocumentImage: React.FC<AuthenticatedDocumentImageProps> = ({ src, alt, className, zoomable }) => {
  const { t } = useTranslation();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let currentUrl: string | null = null;
    setObjectUrl(null);
    setFailed(false);
    setZoomOpen(false);

    apiService
      .get(src, { responseType: 'blob' })
      .then((response) => {
        if (cancelled) return;
        currentUrl = URL.createObjectURL(response.data);
        setObjectUrl(currentUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [src]);

  if (failed) return <span className="text-xs text-ink/40 italic">{t('documentImage.unavailable')}</span>;
  if (!objectUrl) return <span className="text-xs text-ink/40">{t('common.loading')}</span>;

  const image = <img src={objectUrl} alt={alt} className={className} />;

  if (!zoomable) return image;

  return (
    <>
      <button
        type="button"
        onClick={() => setZoomOpen(true)}
        className="block cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label={`Zoom into ${alt}`}
      >
        {image}
      </button>
      {zoomOpen && <ImageLightbox src={objectUrl} alt={alt} onClose={() => setZoomOpen(false)} />}
    </>
  );
};

export default AuthenticatedDocumentImage;
