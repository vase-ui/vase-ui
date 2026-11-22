import '../serverLocation.ts';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import type { ServerRender } from '../serverRender.ts';
import App from './App.vue';

export async function render(): Promise<ServerRender> {
  const app = createSSRApp(App);
  const errors: string[] = [];
  // Vue logs an error of a component and goes on with the render.
  app.config.errorHandler = (error) => {
    errors.push(error instanceof Error ? error.message : String(error));
  };
  const context: { teleports?: Record<string, string> } = {};
  const html = await renderToString(app, context);
  return { html, teleports: context.teleports ?? {}, errors };
}
