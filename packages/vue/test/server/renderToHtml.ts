import { createSSRApp } from 'vue';
import type { Component } from 'vue';
import { renderToString } from 'vue/server-renderer';

/**
 * Renders a component to HTML the way a server does. It runs in Node with no DOM.
 * `file` is the absolute path of a module whose default export is the component.
 */
export async function renderToHtml(file: string, props?: Record<string, unknown>) {
  if (typeof document !== 'undefined') {
    throw new Error(
      'renderToHtml ran in a DOM environment. The HTML is then not the HTML of a server, because a server has no DOM. Call it through `renderOnServer`.',
    );
  }

  const module = (await import(/* @vite-ignore */ file)) as { default: Component };
  const warnings: string[] = [];
  const app = createSSRApp(module.default, props);
  app.config.warnHandler = (message, _instance, trace) => {
    warnings.push(trace ? `${message}\n${trace}` : message);
  };

  const html = await renderToString(app);
  return { html, warnings };
}
