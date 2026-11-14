import { onTestFinished } from 'vitest';
import { createApp, createSSRApp, nextTick } from 'vue';
import type { App, Component } from 'vue';
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

async function mountAndSettle(app: App, container: HTMLElement) {
  app.mount(container);
  await nextTick();
  await nextTick();
}

/**
 * Hydrates the server HTML of a component, and throws when the hydration is not clean. A hydration
 * is not clean when Vue warns, when a console call occurs, or when the hydrated DOM differs from a
 * client-only render of the same component.
 *
 * The client-only render comes first, and the helper removes it before it hydrates. The document
 * thus holds one app at a time, as a page does. The two apps generate the same ids, so a
 * `<label for>` of one app would name a control of the other app.
 */
export async function hydrate(
  component: Component,
  { serverHtml, props }: HydrateOptions,
): Promise<HydrateResult> {
  const clientDom = await renderOnClient(component, props);

  const container = document.createElement('div');
  document.body.append(container);
  const app = createSSRApp(component, props);
  recordVueWarnings(app);

  onTestFinished(() => {
    try {
      app.unmount();
    } catch {
      // An app whose hydration failed can fail to unmount.
    }
    container.remove();
  });

  // `innerHTML` does not run an inline script, and a server HTML can hold one.
  const range = document.createRange();
  range.selectNodeContents(container);
  container.append(range.createContextualFragment(serverHtml));

  await mountAndSettle(app, container);
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

async function renderOnClient(
  component: Component,
  props: Record<string, unknown> | undefined,
): Promise<string> {
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp(component, props);
  recordVueWarnings(app);

  try {
    await mountAndSettle(app, container);
    return serializeChildren(container);
  } finally {
    app.unmount();
    container.remove();
  }
}

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
