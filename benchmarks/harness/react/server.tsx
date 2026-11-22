import '../serverLocation.ts';
import { renderToString } from 'react-dom/server';
import type { ServerRender } from '../serverRender.ts';
import { HydrationApp } from './HydrationApp.tsx';

// A React portal renders nothing on the server, and `renderToString` throws each error.
export function render(): ServerRender {
  return { html: renderToString(<HydrationApp />), teleports: {}, errors: [] };
}
