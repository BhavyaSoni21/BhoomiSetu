import { useCallback, useEffect, useState } from 'react';

// The browser fires `beforeinstallprompt` when the PWA is installable, and it
// often fires early — before a late-mounting component (the footer sits at the
// bottom of the page) can attach a listener. So we capture it at module load
// (this file is imported from main.tsx at startup) into module state and let
// the hook subscribe. Calling .prompt() only ever happens from an explicit
// badge click, so the native "Install app?" consent dialog is what actually
// adds it to the home screen — nothing installs silently. iOS Safari never
// fires this event; there we fall back to manual "Add to Home Screen" steps.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

let deferred: BeforeInstallPromptEvent | null = null;
let installed =
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true);

const subscribers = new Set<() => void>();
const notify = () => subscribers.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // suppress Chrome's mini-infobar; we trigger it from the badge
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    notify();
  });
}

const isIOS =
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !(window as { MSStream?: unknown }).MSStream;

export function usePwaInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!deferred) return 'unavailable';
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') installed = true;
    deferred = null; // a captured prompt can only be used once
    notify();
    return outcome;
  }, []);

  return { canInstall: !!deferred, installed, isIOS, promptInstall };
}
