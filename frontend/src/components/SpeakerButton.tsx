import React, { useState, useRef } from 'react';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

interface SpeakerButtonProps {
  text: string;
  lang?: string;
  className?: string;
}

type State = 'idle' | 'loading' | 'playing' | 'error';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8000/api/v1';

// Module-level in-memory cache for generated TTS audio URLs: `${lang}:${text}` -> objectUrl
const ttsAudioCache = new Map<string, string>();

/**
 * Strips technical codes, hex hashes, UUIDs, and raw enum underscores 
 * so the TTS engine reads natural human language instead of technical IDs.
 */
function cleanTextForSpeech(input: string): string {
  if (!input) return '';
  return input
    // Remove UUIDs
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '')
    // Remove hashtag hex/id hashes (e.g. #a1b2c3d4)
    .replace(/#[0-9a-fA-F]{4,}/g, '')
    // Replace underscores with spaces (e.g. IN_PROGRESS -> IN PROGRESS)
    .replace(/_/g, ' ')
    .trim();
}

export const SpeakerButton: React.FC<SpeakerButtonProps> = ({ text, lang, className = '' }) => {
  const { currentLang } = useTranslation();
  const [state, setState] = useState<State>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const effectiveLang = lang ?? currentLang;
  const printableText = cleanTextForSpeech(text);

  const stopCurrent = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const playAudio = (objectUrl: string) => {
    stopCurrent();
    const audio = new Audio(objectUrl);
    audioRef.current = audio;

    audio.onended = () => {
      setState('idle');
      audioRef.current = null;
    };
    audio.onerror = () => {
      setState('error');
      audioRef.current = null;
      setTimeout(() => setState('idle'), 2000);
    };

    setState('playing');
    audio.play().catch(() => {
      setState('error');
      audioRef.current = null;
      setTimeout(() => setState('idle'), 2000);
    });
  };

  const handleClick = async () => {
    // If already playing, stop it
    if (state === 'playing') {
      stopCurrent();
      setState('idle');
      return;
    }

    if (!printableText) return;

    const cacheKey = `${effectiveLang}:${printableText}`;

    // Check if audio is already cached
    if (ttsAudioCache.has(cacheKey)) {
      const cachedUrl = ttsAudioCache.get(cacheKey)!;
      playAudio(cachedUrl);
      return;
    }

    stopCurrent();
    setState('loading');

    try {
      const token = localStorage.getItem('access_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // POST /api/v1/multilingual/tts - body: { text: printableText, language }
      const response = await fetch(`${API_BASE}/multilingual/tts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: printableText, language: effectiveLang }),
      });

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status}`);
      }

      // The endpoint returns WAV binary body
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      
      // Save to cache for instant replaying
      ttsAudioCache.set(cacheKey, objectUrl);

      playAudio(objectUrl);
    } catch {
      setState('error');
      stopCurrent();
      setTimeout(() => setState('idle'), 2000);
    }
  };

  const baseClass = [
    'inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-150',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bhashini-accent)]',
    state === 'error'
      ? 'text-red-500'
      : state === 'playing'
      ? 'text-[var(--bhashini-accent)] bg-emerald-50 dark:bg-emerald-900/20'
      : 'text-[var(--text-secondary)] hover:text-[var(--bhashini-accent)] hover:bg-[var(--surface-2)]',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const label =
    state === 'loading'
      ? 'Loading audio…'
      : state === 'playing'
      ? 'Stop audio'
      : state === 'error'
      ? 'Audio unavailable'
      : 'Read aloud';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === 'loading'}
      aria-label={label}
      title={label}
      className={baseClass}
    >
      {state === 'loading' ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : state === 'error' ? (
        <VolumeX className="w-4 h-4" aria-hidden="true" />
      ) : (
        <Volume2 className="w-4 h-4" aria-hidden="true" />
      )}
    </button>
  );
};

export default SpeakerButton;

