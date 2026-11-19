import { afterEach, beforeEach, inject } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as vue from 'vue';
import { renderOnServer as renderFileOnServer } from './hydration';

/** The app that a test project mounts: virtual DOM or Vapor, and with the interop plugin or not. */
export type AppKind = 'vdom' | 'vdom-interop' | 'vapor' | 'vapor-interop';

declare module 'vitest' {
  interface ProvidedContext {
    app: AppKind;
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

/**
 * For each submit of the test, whether a listener of the form prevented its default action. The
 * listener of the document runs after them, and it prevents the action, so that the page stays.
 */
export const submitsPrevented: boolean[] = [];

function stopSubmit(event: Event) {
  submitsPrevented.push(event.defaultPrevented);
  event.preventDefault();
}

beforeEach(() => {
  document.addEventListener('submit', stopSubmit);
});

afterEach(() => {
  document.removeEventListener('submit', stopSubmit);
  submitsPrevented.length = 0;
  while (cleanups.length > 0) cleanups.pop()!();
});

function createAppOf(component: vue.Component, props: Record<string, unknown>, hydrate: boolean) {
  const kind = inject('app');
  // A Vapor app takes a Vapor root. The project `vapor` of `vitest.config.ts` compiles no fixture
  // as Vapor, so its fixtures mount in an app of the virtual DOM. `vitest.vue-3.6.config.ts` runs
  // the setups with a Vapor app.
  const vaporRoot = (component as { __vapor?: boolean }).__vapor === true;
  const create =
    kind.startsWith('vapor') && vaporRoot
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
  if (!/^[A-Za-z]+$/.test(fixture)) throw new Error(`There is no fixture "${fixture}".`);
  const root = document.body.appendChild(document.createElement('div'));
  root.innerHTML = await renderFileOnServer(`test/fixtures/${fixture}.vue`, props);
  cleanups.push(() => root.remove());
  return root;
}

export function hydrate(component: vue.Component, props: Record<string, unknown>, root: Element) {
  const app = createAppOf(component, props, true);
  const exposed = app.mount(root) as Exposed;
  cleanups.push(() => app.unmount());
  return exposed;
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
