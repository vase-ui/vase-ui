// Measurements with plain Vue, with no code of the library. They state what `<component :is>`
// renders and what a function ref on it gets: for a tag, for `RouterLink` of vue-router (a virtual
// DOM component with no `expose`) and for a Vapor component that exposes `element`. Each project
// mounts them in its own app, and renders them on a server and hydrates them.
import { inject, onTestFinished, test } from 'vitest';
import { expect } from 'vitest';
import { nextTick, version } from 'vue';
import type { Component } from 'vue';
import MeasureComponentIs from '../fixtures/MeasureComponentIs.vue';
import MeasureComponentIsVapor from '../fixtures/MeasureComponentIsVapor.vue';
import MeasureGlobalButton from '../fixtures/MeasureGlobalButton.vue';
import MeasureRegisteredButton from '../fixtures/MeasureRegisteredButton.vue';
import { createAppOf, hydrate, mount, renderOnServer } from '../render';

type Is = 'h2' | 'router-link' | 'vapor';

const app = inject('app');
const vue36 = version.startsWith('3.6');
// A Vapor app renders a virtual DOM component, and a virtual DOM app renders a Vapor component,
// only with the interop plugin.
const interop = app.endsWith('interop');
const vaporApp = app.startsWith('vapor');

/** The fixture compiled as Vapor with Vue 3.6, in the setups that can render a Vapor component. */
const vaporFixture = vue36 && (vaporApp || interop) ? [MeasureComponentIsVapor] : [];
/** The fixture in the mode of the project: Vapor in a Vapor app, else virtual DOM. */
const fixtures: [string, Component][] = [
  ['the fixture of the project', MeasureComponentIs],
  ...vaporFixture.map((fixture): [string, Component] => ['the Vapor fixture', fixture]),
];

function localName(node: unknown) {
  return node instanceof Element ? node.localName : null;
}

/** What the function ref got: an element, or a public instance with `$el` and `element`. */
function read(value: unknown) {
  if (value instanceof Element) return { element: value.localName };
  const instance = value as { $el?: unknown; element?: unknown };
  return { instance: { $el: localName(instance.$el), element: localName(instance.element) } };
}

/** Whether the parent can render `is`: a virtual DOM component in a Vapor app needs interop. */
function renders(is: Is, fixture: Component) {
  const vaporParent = fixture === MeasureComponentIsVapor || (vue36 && vaporApp);
  if (is === 'router-link') return !vaporParent || interop;
  if (is === 'vapor') return !vue36 || vaporParent || interop;
  return true;
}

const expected = {
  h2: { element: 'h2' },
  'router-link': { instance: { $el: 'a', element: null } },
  // Vue 3.5 compiles `<script setup vapor>` as a virtual DOM component. A Vapor component has no
  // `$el`: a ref on it gets only what it exposes.
  vapor: { instance: { $el: vue36 ? null : 'button', element: 'button' } },
};

const ALL: Is[] = ['h2', 'router-link', 'vapor'];
const cases = fixtures.flatMap(([name, fixture]) =>
  ALL.filter((is) => renders(is, fixture)).map((is) => ({ name, fixture, is })),
);

test.each(cases)(
  'in $name, a function ref on <component :is> for $is gets the element, else the public instance with its root element or its exposed element',
  async ({ fixture, is }) => {
    const values: unknown[] = [];
    const { root } = mount(fixture, {
      is,
      probe: { record: (value: unknown) => values.push(value) },
    });
    await nextTick();
    const value = values.at(-1);
    expect(read(value)).toEqual(expected[is]);
    const element = root.querySelector('[data-probe]')!;
    expect(element.localName).toBe(is === 'h2' ? 'h2' : is === 'router-link' ? 'a' : 'button');
    const instance = value as { $el?: unknown; element?: unknown };
    expect(value instanceof Element ? value : (instance.element ?? instance.$el)).toBe(element);
  },
);

test.each(ALL.filter((is) => renders(is, MeasureComponentIs)))(
  'the server HTML of <component :is> for %s hydrates with no message, and the function ref gets the server element',
  async (is) => {
    const root = await renderOnServer('MeasureComponentIs', { is });
    const server = root.querySelector('[data-probe]')!;
    expect(server.localName).toBe(is === 'h2' ? 'h2' : is === 'router-link' ? 'a' : 'button');
    const values: unknown[] = [];
    hydrate(
      MeasureComponentIs,
      { is, probe: { record: (value: unknown) => values.push(value) } },
      root,
    );
    await nextTick();
    expect(read(values.at(-1))).toEqual(expected[is]);
    expect(root.querySelector('[data-probe]')).toBe(server);
  },
);

test('a string in <component :is> resolves a component of that name that the app registers: `button` renders a registered `Button`', async () => {
  const root = document.body.appendChild(document.createElement('div'));
  const measured = createAppOf(MeasureGlobalButton, { is: 'button' }, false);
  // eslint-disable-next-line vue/no-reserved-component-names -- An app can register a component with the name of an HTML element.
  measured.component('Button', MeasureRegisteredButton);
  measured.mount(root);
  onTestFinished(() => {
    measured.unmount();
    root.remove();
  });
  await nextTick();
  expect(root.querySelector('button')).toBeNull();
  expect(root.querySelector('[data-registered-button]')).not.toBeNull();
});
