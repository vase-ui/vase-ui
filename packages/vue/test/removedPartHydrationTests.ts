import { expect, it } from 'vitest';
import type { Component } from 'vue';
import { hydrate, renderOnServer } from './hydration';

/**
 * The shared cases of a part that binds an `aria-*` value that a later part gives. The fixture
 * removes or changes the later part in the first flush after the mount. Each case asserts the
 * value of the server HTML, and the value after the hydration. `hydrate` also fails the case when
 * the hydrated DOM differs from a client-only render.
 */
export function removedPartHydrationTests(config: RemovedPartHydrationTestsConfig) {
  const { file, component, cases } = config;

  it.each(cases)(
    'writes the client value of an aria attribute after the hydration, $name',
    async ({ props, selector, attribute, serverValue, clientValue }) => {
      const serverHtml = await renderOnServer(file, props);
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(template.content.querySelector(selector)?.getAttribute(attribute)).toBe(serverValue);

      const { container } = await hydrate(component, { serverHtml, props });

      const element = container.querySelector(selector);
      expect(element).toBeInTheDocument();
      expect(element?.getAttribute(attribute)).toBe(clientValue);
    },
  );
}

export interface RemovedPartHydrationTestsConfig {
  /** The path of the fixture from the root of the package, for `renderOnServer`. */
  file: string;
  /** The fixture, for `hydrate`. */
  component: Component;
  cases: RemovedPartHydrationCase[];
}

export interface RemovedPartHydrationCase {
  /** The `$name` of the case, 40 characters or fewer. */
  name: string;
  /** The props of the fixture, with the later part that it removes at the mount. */
  props: Record<string, unknown>;
  /** The element that has the attribute. */
  selector: string;
  attribute: string;
  /** The value of the attribute in the server HTML. */
  serverValue: string;
  /** The value of the attribute after the hydration, or `null` for no attribute. */
  clientValue: string | null;
}
