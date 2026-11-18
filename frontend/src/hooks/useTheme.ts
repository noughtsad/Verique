'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

// Keep in sync with THEME_SCRIPT in app/layout.tsx.
const STORAGE_KEY = 'verique-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') return preference;
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

function apply(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia(DARK_QUERY);
  // Following the device setting only matters while the preference is "system".
  const onSystemChange = () => {
    if (readPreference() === 'system') {
      apply(resolve('system'));
      notify();
    }
  };
  // Another tab changed the preference.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      apply(resolve(readPreference()));
      notify();
    }
  };
  media.addEventListener('change', onSystemChange);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener('change', onSystemChange);
    window.removeEventListener('storage', onStorage);
  };
}

// The snapshot must be a stable primitive for useSyncExternalStore.
const getSnapshot = () => `${readPreference()}:${resolve(readPreference())}`;
const getServerSnapshot = () => 'system:dark';

/** The theme preference (System / Light / Dark) and the theme actually shown. */
export function useTheme() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [preference, resolved] = snapshot.split(':') as [ThemePreference, ResolvedTheme];

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage blocked (private mode): the choice still applies to this page.
    }
    apply(resolve(next));
    notify();
  }, []);

  return { preference, resolved, setPreference };
}
