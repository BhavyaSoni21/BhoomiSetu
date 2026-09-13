import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SCALE_STEP = 0.5;

// Full-screen zoom viewer for officer document review (docs/FRONTEND_UPGRADE_SPEC.md
// follow-up, "officer must be able to zoom to the papers") - reuses whatever
// object URL the caller already fetched (AuthenticatedDocumentImage), no
// re-fetch. +/- buttons and mouse-wheel both adjust the same scale state.
const ImageLightbox: React.FC<ImageLightboxProps> = ({ src, alt, onClose }) => {
  const [scale, setScale] = useState(1);

  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP));
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP));

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + (e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP))));
  };

  return (
    <div
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); zoomOut(); }}
          disabled={scale <= MIN_SCALE}
          aria-label="Zoom out"
          className="w-9 h-9 flex items-center justify-center border-2 border-white/40 bg-black/40 text-white hover:bg-black/60 transition disabled:opacity-40"
        >
          <ZoomOut className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); zoomIn(); }}
          disabled={scale >= MAX_SCALE}
          aria-label="Zoom in"
          className="w-9 h-9 flex items-center justify-center border-2 border-white/40 bg-black/40 text-white hover:bg-black/60 transition disabled:opacity-40"
        >
          <ZoomIn className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-9 h-9 flex items-center justify-center border-2 border-white/40 bg-black/40 text-white hover:bg-black/60 transition"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      <div className="w-full h-full flex items-center justify-center overflow-auto" onWheel={handleWheel}>
        <img
          src={src}
          alt={alt}
          onClick={(e) => e.stopPropagation()}
          style={{ transform: `scale(${scale})`, transition: 'transform 0.15s ease-out', cursor: 'default' }}
          className="max-w-full max-h-full object-contain"
        />
      </div>
    </div>
  );
};

export default ImageLightbox;
