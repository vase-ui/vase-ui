import { onTestFinished, vi } from 'vitest';
import { createApp, createSSRApp, nextTick } from 'vue';
import type { App, Component } from 'vue';
import { installPartsInterop } from './testApp';
import { recordVueWarnings, takeReportedMessages } from './reportedMessages';

declare module 'vitest/browser' {
  interface BrowserCommands {
    renderOnServer: (
      file: string,
      props?: Record<string, unknown>,
    ) => Promise<{ html: string; warnings: string[] }>;
  }
}

export interface HydrateOptions {
  /** The HTML that a server made for the component. */
  serverHtml: string;
  props?: Record<string, unknown> | undefined;
}

export interface HydrateResult {
  container: HTMLElement;
}

export interface HydrateAfterOptions extends HydrateOptions {
  /**
   * Gets the container with the server HTML, before the app mounts. It does what a user or a
   * browser does before the scripts of a page run, such as a focus, a key press or a write of
   * `input.value`.
   */
  before: (container: HTMLElement) => void | Promise<void>;
}

/**
 * Renders a component on a server and returns its HTML.
 * The server render runs in Node with no DOM, through a Vitest browser command.
 * @param file The path of a Vue file from the root of the package: `test/fixtures/PlainPart.vue`.
 * Its default export is the component.
 */
export async function renderOnServer(
  file: string,
  props?: Record<string, unknown>,
): Promise<string> {
  const { commands } = await import('vitest/browser');
  const { html, warnings } = await commands.renderOnServer(file, props);

  if (warnings.length > 0) {
    throw new Error(`The server render of ${file} gave Vue warnings:\n${warnings.join('\n')}`);
  }

  return html;
}

// `innerHTML` does not run an inline script, and a server HTML can hold one.
function insertServerHtml(serverHtml: string): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  onTestFinished(() => {
    container.remove();
  });
  const range = document.createRange();
  range.selectNodeContents(container);
  container.append(range.createContextualFragment(serverHtml));
  return container;
}

// The hooks of `onTestFinished` run in reverse order, so the app unmounts before its container
// goes.
async function mountServerHtml(
  component: Component,
  props: Record<string, unknown> | undefined,
  container: HTMLElement,
) {
  const app = installPartsInterop(createSSRApp(component, props));
  recordVueWarnings(app);
  onTestFinished(() => {
    try {
      app.unmount();
    } catch {
      // An app whose hydration failed can fail to unmount.
    }
  });
  await mountAndSettle(app, container);
}

async function mountAndSettle(app: App, container: HTMLElement) {
  app.mount(container);
  await nextTick();
  await nextTick();
}

/**
 * Hydrates the server HTML of a component, and throws when the hydration is not clean. A hydration
 * is not clean when Vue warns, when a console call occurs, or when the hydrated DOM differs from a
 * client-only render of the same component. The check comes after the mount and two ticks.
 *
 * The client-only render comes first, and the helper removes it before it hydrates. The document
 * thus holds one app at a time, as a page does. The two apps generate the same ids. In one
 * document, a `<label for>` of one app names a control of the other app.
 */
export async function hydrate(
  component: Component,
  { serverHtml, props }: HydrateOptions,
): Promise<HydrateResult> {
  const clientDom = await renderOnClient(component, props);

  const container = insertServerHtml(serverHtml);
  await mountServerHtml(component, props, container);
  const hydratedDom = serializeChildren(container);

  // Vue writes some hydration messages only to the console.
  const messages = takeReportedMessages();
  const problems: string[] = [];
  if (messages.length > 0) {
    problems.push(`Vue and the console reported:\n${messages.join('\n')}`);
  }
  if (hydratedDom !== clientDom) {
    problems.push(
      `The hydrated DOM differs from a client-only render.\nHydrated:    ${hydratedDom}\nClient-only: ${clientDom}`,
    );
  }
  if (problems.length > 0) {
    throw new Error(`The hydration is not clean.\n\n${problems.join('\n\n')}`);
  }

  return { container };
}

/**
 * Inserts the server HTML of a component, calls `before`, and then hydrates the HTML. It throws
 * when Vue warns or a console call occurs. The check comes after the mount and two ticks. It does
 * not compare the DOM with a client-only render, because `before` changes the DOM.
 */
export async function hydrateAfter(
  component: Component,
  { serverHtml, props, before }: HydrateAfterOptions,
): Promise<HydrateResult> {
  const container = insertServerHtml(serverHtml);
  await before(container);
  await mountServerHtml(component, props, container);

  // Vue writes some hydration messages only to the console.
  const messages = takeReportedMessages();
  if (messages.length > 0) {
    throw new Error(
      `The hydration is not clean.\n\nVue and the console reported:\n${messages.join('\n')}`,
    );
  }

  return { container };
}

/**
 * Gives `html` with `value` in the attribute `name` of the first element that matches `selector`.
 * A case of a server whose `Intl` data differs from the data of the browser changes the server
 * HTML with it.
 */
export function setAttributeInHtml(
  html: string,
  selector: string,
  name: string,
  value: string,
): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  const element = template.content.querySelector(selector);
  if (!element) {
    throw new Error(`No element of the HTML matches \`${selector}\`.`);
  }
  element.setAttribute(name, value);
  return template.innerHTML;
}

function mockNavigation(navigation: Partial<PerformanceNavigationTiming>) {
  const getEntriesByType = performance.getEntriesByType.bind(performance);
  const spy = vi
    .spyOn(performance, 'getEntriesByType')
    .mockImplementation((entryType) =>
      entryType === 'navigation'
        ? [navigation as PerformanceNavigationTiming]
        : getEntriesByType(entryType),
    );
  onTestFinished(() => {
    spy.mockRestore();
  });
}

/**
 * Gives a `back_forward` navigation until the test ends. Its `load` event ends only when the case
 * calls the returned function. A part that mounts before then waits for the `pageshow` event of the
 * page.
 * @returns Ends `load` and sends `pageshow`, in the order of the browser.
 */
export function mockPageBeforeLoad(): () => void {
  const navigation = { type: 'back_forward' as const, loadEventEnd: 0 };
  mockNavigation(navigation);
  return () => {
    navigation.loadEventEnd = performance.now();
    window.dispatchEvent(new PageTransitionEvent('pageshow'));
  };
}

/**
 * Records the type of each `input`, `change`, `blur` and `focusout` event that reaches `target`
 * until the test ends.
 */
export function recordInputEvents(target: EventTarget): string[] {
  const types: string[] = [];
  const record = (event: Event) => {
    types.push(event.type);
  };
  const eventTypes = ['input', 'change', 'blur', 'focusout'];
  for (const type of eventTypes) {
    target.addEventListener(type, record, true);
  }
  onTestFinished(() => {
    for (const type of eventTypes) {
      target.removeEventListener(type, record, true);
    }
  });
  return types;
}

async function renderOnClient(
  component: Component,
  props: Record<string, unknown> | undefined,
): Promise<string> {
  const container = document.createElement('div');
  document.body.append(container);
  const app = installPartsInterop(createApp(component, props));
  recordVueWarnings(app);

  try {
    await mountAndSettle(app, container);
    return serializeChildren(container);
  } finally {
    try {
      app.unmount();
    } finally {
      container.remove();
    }
  }
}

// `useVaseUiId` gives `vase-ui-` and the id of Vue's `useId`, such as `v-0` or `v-1-2`.
function serializeChildren(element: Element): string {
  return Array.from(element.childNodes, serialize).join('');
}

// Text keeps its text, and attributes are in the order of their names.
// A comment is dropped, because Vue keeps the comment anchors of a server render where a
// client-only render has empty text nodes.
// `style` is the style that the browser parsed, and an empty style has no attribute.
// Vue writes `border:0` on a server and does not patch `style` when it hydrates.
// A browser writes `border: 0px` for a client-only render.
// An empty `class` has no attribute. For an undefined `class` on a root element, Vue writes no
// attribute on a server and `class=""` on a client.
function serialize(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue ?? '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as Element & ElementCSSInlineStyle;
  const attributes = Array.from(element.attributes, ({ name, value }) => ({
    name,
    value: name === 'style' ? element.style.cssText : value,
  }))
    .filter(({ name, value }) => !((name === 'style' || name === 'class') && value === ''))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const tag = element.localName;
  const attributeText = attributes.map(({ name, value }) => ` ${name}="${value}"`).join('');

  return `<${tag}${attributeText}>${serializeChildren(element)}</${tag}>`;
}
