import { createRoot } from 'react-dom/client';
import { start } from '../start.ts';
import { App } from './App.tsx';

start(() => {
  createRoot(document.getElementById('app') as HTMLElement).render(<App />);
});
