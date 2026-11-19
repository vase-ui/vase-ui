import { afterEach, beforeEach, expect, inject, vi, type MockInstance } from 'vitest';
import { commands, userEvent } from 'vitest/browser';
import * as vue from 'vue';

/** The app that a test project mounts: virtual DOM or Vapor, and with the interop plugin or not. */
export type AppKind = 'vdom' | 'vdom-interop' | 'vapor' | 'vapor-interop';

declare module 'vitest' {
  interface ProvidedContext {
    app: AppKind;
  }
}

declare module 'vitest/browser' {
  interface BrowserCommands {
    renderOnServer: (fixture: string, props: Record<string, unknown>) => Promise<string>;
  }
}

// Vue 3.5 has no Vapor API. Only the projects that run with Vue 3.6 create a Vapor app.
const { createVaporApp, createVaporSSRApp, vaporInteropPlugin } = vue as unknown as {
  createVaporApp: typeof vue.createApp;
  createVaporSSRApp: typeof vue.createSSRApp;
  vaporInteropPlugin: vue.Plugin;
};

/** The exposed values of a fixture. */
export type Exposed = Record<string, any>;

const cleanups: (() => void)[] = [];
let warn: MockInstance<typeof console.warn>;
let error: MockInstance<typeof console.error>;

/**
 * For each submit of the test, whether a listener of the form prevented its default action. The
 * listener of the document runs after them, and it prevents the action, so that the page stays.
 */
export const submitsPrevented: boolean[] = [];

function stopSubmit(event: Event) {
  submitsPrevented.push(event.defaultPrevented);
  event.preventDefault();
}

// Every test fails on a message of Vue: a warning, or a hydration mismatch.
beforeEach(() => {
  warn = vi.spyOn(console, 'warn');
  error = vi.spyOn(console, 'error');
  document.addEventListener('submit', stopSubmit);
});

afterEach(() => {
  document.removeEventListener('submit', stopSubmit);
  submitsPrevented.length = 0;
  while (cleanups.length > 0) cleanups.pop()!();
  expect(warn).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

function createAppOf(component: vue.Component, props: Record<string, unknown>, hydrate: boolean) {
  const kind = inject('app');
  const create = kind.startsWith('vapor')
    ? hydrate
      ? createVaporSSRApp
      : createVaporApp
    : hydrate
      ? vue.createSSRApp
      : vue.createApp;
  const app = create(component, props);
  if (kind.endsWith('interop')) app.use(vaporInteropPlugin);
  return app;
}

export function mount(
  component: vue.Component,
  props: Record<string, unknown> = {},
  container: ParentNode = document.body,
) {
  const root = container.appendChild(document.createElement('div'));
  const app = createAppOf(component, props, false);
  const exposed = app.mount(root) as Exposed;
  cleanups.push(() => {
    app.unmount();
    root.remove();
  });
  return { root, exposed };
}

/** Mounts a component that throws, and returns the error. */
export function mountError(component: vue.Component) {
  const root = document.body.appendChild(document.createElement('div'));
  const app = createAppOf(component, {}, false);
  let error: unknown;
  app.config.errorHandler = (thrown) => {
    error ??= thrown;
  };
  app.mount(root);
  cleanups.push(() => {
    app.unmount();
    root.remove();
  });
  return error;
}

/** Renders a fixture of `test/fixtures` on the server, in Node. */
export async function renderOnServer(fixture: string, props: Record<string, unknown> = {}) {
  const root = document.body.appendChild(document.createElement('div'));
  root.innerHTML = await commands.renderOnServer(fixture, props);
  cleanups.push(() => root.remove());
  return root;
}

export function hydrate(component: vue.Component, props: Record<string, unknown>, root: Element) {
  const app = createAppOf(component, props, true);
  app.mount(root);
  cleanups.push(() => app.unmount());
}

/** Types `text` after the value, as a user who clicks after the text. */
export async function typeAtEnd(element: HTMLInputElement | HTMLTextAreaElement, text: string) {
  element.focus();
  element.setSelectionRange(element.value.length, element.value.length);
  await userEvent.keyboard(text);
}

/** Waits for the tasks that a form reset starts. */
export async function settle() {
  await new Promise((resolve) => setTimeout(resolve));
  await vue.nextTick();
}
