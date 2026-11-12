import { onTestFinished, vi } from 'vitest';
import { createApp, createSSRApp, nextTick } from 'vue';
import type { App, Component } from 'vue';

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
  /**
   * The Vue warnings and the calls to `console.warn` and `console.error`.
   * The list stays live until the test ends.
   */
  messages: readonly string[];
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

let consoleMessages: string[] | undefined;

// Vue writes some hydration messages only to the console. The spies cover the whole test, because a
// part can warn after `hydrate` resolves.
function recordConsole(): string[] {
  if (consoleMessages) {
    return consoleMessages;
  }

  const messages: string[] = [];
  const spies = (['warn', 'error'] as const).map((method) =>
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      messages.push(`console.${method}: ${args.map(String).join(' ')}`);
    }),
  );

  consoleMessages = messages;
  onTestFinished(() => {
    for (const spy of spies) {
      spy.mockRestore();
    }
    consoleMessages = undefined;
  });

  return messages;
}

// The handler records the warning and never throws. After a `warnHandler` throws, Vue gives no
// more warnings on that page.
function recordWarnings(app: App, messages: string[]) {
  app.config.warnHandler = (message, _instance, trace) => {
    messages.push(`Vue warning: ${message}${trace ? `\n${trace}` : ''}`);
  };
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
 */
export async function hydrate(
  component: Component,
  { serverHtml, props }: HydrateOptions,
): Promise<HydrateResult> {
  const messages = recordConsole();
  const apps: App[] = [];
  const containers: HTMLElement[] = [];

  onTestFinished(() => {
    for (const app of apps) {
      try {
        app.unmount();
      } catch {
        // An app whose hydration failed can fail to unmount.
      }
    }
    for (const container of containers) {
      container.remove();
    }
  });

  function createContainer() {
    const container = document.createElement('div');
    document.body.append(container);
    containers.push(container);
    return container;
  }

  const container = createContainer();
  // `innerHTML` does not run an inline script, and a server HTML can hold one.
  const range = document.createRange();
  range.selectNodeContents(container);
  container.append(range.createContextualFragment(serverHtml));

  const hydratingApp = createSSRApp(component, props);
  apps.push(hydratingApp);
  recordWarnings(hydratingApp, messages);
  await mountAndSettle(hydratingApp, container);

  const clientContainer = createContainer();
  const clientApp = createApp(component, props);
  apps.push(clientApp);
  recordWarnings(clientApp, messages);
  await mountAndSettle(clientApp, clientContainer);

  const hydratedDom = serializeChildren(container);
  const clientDom = serializeChildren(clientContainer);

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

  return { container, messages };
}

function serializeChildren(element: Element): string {
  return Array.from(element.childNodes, serialize).join('');
}

// Text keeps its text, a comment is dropped, attributes are in the order of their names, and
// `style` is a sorted list of declarations. Vue keeps the comment anchors of a server render where
// a client-only render has empty text nodes, and the server writes `style` in its own format.
function serialize(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue ?? '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as Element;
  const attributes = Array.from(element.attributes, ({ name, value }) => ({
    name,
    value: name === 'style' ? normalizeStyle(value) : value,
  })).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const tag = element.localName;
  const attributeText = attributes.map(({ name, value }) => ` ${name}="${value}"`).join('');

  return `<${tag}${attributeText}>${serializeChildren(element)}</${tag}>`;
}

function normalizeStyle(style: string): string {
  return style
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const colon = declaration.indexOf(':');
      return `${declaration.slice(0, colon).trim()}:${declaration.slice(colon + 1).trim()}`;
    })
    .sort()
    .join(';');
}
