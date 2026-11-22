import { hydrateRoot } from 'react-dom/client';
import { start } from '../start.ts';
import { HydrationApp } from './HydrationApp.tsx';

start(() => {
  hydrateRoot(document.getElementById('app') as HTMLElement, <HydrationApp />);
});
