import { useEffect } from 'react';
import { App } from './App.tsx';

/** The app, with an effect that marks the end of the hydration. The server renders it too. */
export function HydrationApp() {
  useEffect(() => {
    document.documentElement.dataset.benchHydrated = '';
  }, []);
  return <App />;
}
