import React, { useState, useRef, useEffect } from 'react';
import { Mic, Loader2, AlertCircle } from 'lucide-react';
import RecordRTC from 'recordrtc';
import { useTranslation } from '../context/LanguageContext';

interface MicButtonProps {
  onResult: (text: string) => void;
  lang?: string;
  className?: string;
}

type State = 'idle' | 'recording' | 'loading' | 'error';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8000/api/v1';

export const MicButton: React.FC<MicButtonProps> = ({ onResult, lang, className = '' }) => {
  const { currentLang } = useTranslation();
  const [state, setState] = useState<State>('idle');
  const [denied, setDenied] = useState(false);
  
  const recorderRef = useRef<RecordRTC | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const effectiveLang = lang ?? currentLang;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (recorderRef.current && recorderRef.current.getState() === 'recording') {
        recorderRef.current.stopRecording(() => {});
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleTranscribe = async (audioBlob: Blob) => {
    try {
      // POST /api/v1/multilingual/asr
      // Expects: audio (UploadFile/File) and language (Form string)
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.wav');
      formData.append('language', effectiveLang);

      const token = localStorage.getItem('access_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE}/multilingual/asr`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`ASR request failed: ${response.status}`);
      }

      // Response model ASRResponse: { transcribed_text: str, confidence: float | null }
      const data = await response.json();
      if (data && data.transcribed_text) {
        onResult(data.transcribed_text);
      }
      setState('idle');
    } catch (error) {
      console.error('ASR transcription error:', error);
      setState('error');
      setTimeout(() => setState('idle'), 2000);
    }
  };

  const stopRecording = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (recorderRef.current && recorderRef.current.getState() === 'recording') {
      setState('loading'); // Immediately show loading spinner while waiting for audio blob and transcription
      recorderRef.current.stopRecording(() => {
        const audioBlob = recorderRef.current!.getBlob();
        
        // Release microphone
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        handleTranscribe(audioBlob);
      });
    }
  };

  const handleClick = async () => {
    setDenied(false);

    // If currently recording, this click means "stop and transcribe"
    if (state === 'recording') {
      stopRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/wav',
        recorderType: RecordRTC.StereoAudioRecorder, // Forces cross-browser WAV encoding
        desiredSampRate: 16000, // 16kHz exactly what Bhashini prefers
        numberOfAudioChannels: 1, // Mono audio
      });
      recorderRef.current = recorder;

      recorder.startRecording();
      setState('recording');

      // Auto-stop recording after 10 seconds
      timeoutRef.current = window.setTimeout(() => {
        stopRecording();
      }, 10000);
    } catch (err) {
      console.error('Microphone permission denied or unavailable', err);
      setDenied(true);
    }
  };

  const baseClass = [
    'inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-150',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bhashini-accent)] shrink-0',
    state === 'error'
      ? 'text-red-500 bg-red-50'
      : state === 'recording'
      ? 'text-red-600 bg-red-100 dark:bg-red-900/30 animate-pulse'
      : 'text-[var(--text-secondary)] hover:text-[var(--bhashini-accent)] hover:bg-[var(--surface-2)]',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const label =
    state === 'loading'
      ? 'Transcribing…'
      : state === 'recording'
      ? 'Stop recording'
      : state === 'error'
      ? 'Transcription failed'
      : 'Speak';

  return (
    <div className="relative inline-flex items-center gap-2">
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
          <AlertCircle className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Mic className="w-4 h-4" aria-hidden="true" />
        )}
      </button>
      
      {denied && (
        <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100 whitespace-nowrap absolute left-full ml-1 z-10 shadow-sm">
          Microphone access denied
        </span>
      )}
    </div>
  );
};

export default MicButton;
