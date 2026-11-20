import { describe, expect, inject, onTestFinished, test } from 'vitest';
import { nextTick, version } from 'vue';
import AsParts from './fixtures/AsParts.vue';
import MeasureRegisteredButton from './fixtures/MeasureRegisteredButton.vue';
import { createAppOf, hydrate, mount, renderOnServer, type Exposed } from './render';
import { waitFor } from './waitFor';

// The element of each part with no `as`.
const TAGS = {
  'Avatar.Root': 'span',
  'Avatar.Fallback': 'span',
  Button: 'button',
  CheckboxGroup: 'div',
  RadioGroup: 'div',
  'Field.Root': 'div',
  'Field.Description': 'p',
  'Field.Error': 'div',
  'Field.Item': 'div',
  'Fieldset.Legend': 'legend',
  'Meter.Root': 'div',
  'Meter.Label': 'span',
  'Meter.Value': 'span',
  'Meter.Track': 'div',
  'Meter.Indicator': 'div',
  'Progress.Root': 'div',
  'Progress.Label': 'span',
  'Progress.Value': 'span',
  'Progress.Track': 'div',
  'Progress.Indicator': 'div',
  'ScrollArea.Root': 'div',
  'ScrollArea.Viewport': 'div',
  'ScrollArea.Content': 'div',
  'ScrollArea.Scrollbar': 'div',
  'ScrollArea.Thumb': 'div',
  'ScrollArea.Corner': 'div',
  Separator: 'div',
  'Tabs.Root': 'div',
  'Tabs.List': 'div',
  'Tabs.Tab': 'button',
  'Tabs.Panel': 'div',
  'Tabs.Indicator': 'span',
};
const PARTS = Object.keys(TAGS);
const SECTIONS = Object.fromEntries(PARTS.map((part) => [part, 'section']));

const app = inject('app');
// A Vapor part renders a virtual DOM component, and a virtual DOM part renders a Vapor component,
// only with the interop plugin. With Vue 3.5, `<script setup vapor>` compiles as virtual DOM.
const COMPONENTS = [
  // The root element of `RouterLink`, which exposes nothing.
  ...(app === 'vapor' ? [] : [{ name: 'RouterLink', element: 'a' }]),
  // The `<span>` that the component exposes in a `<div>`.
  { name: 'ExposedInner', element: 'span' },
  // The `<button>` that a Vapor component exposes.
  ...(version.startsWith('3.6') && app === 'vdom' ? [] : [{ name: 'Vapor', element: 'button' }]),
];

function partElement(root: Element, part: string) {
  return root.querySelector(`[data-part="${part}"]`)!;
}

function elementOf(exposed: Exposed, part: string) {
  return (exposed.parts as Record<string, { element: Element | null }>)[part]!.element;
}

// Vapor marks a dynamic component with comments.
function elementsHtml(root: Element) {
  return root.innerHTML.replaceAll(/<!--.*?-->/g, '');
}

/** Waits until the scroll area measures the overflow on both axes and shows its corner. */
async function mountParts(props: Record<string, unknown> = {}) {
  const mounted = mount(AsParts, props);
  await waitFor(() => expect(partElement(mounted.root, 'ScrollArea.Corner')).not.toBeNull());
  return mounted;
}

describe('prop: as', () => {
  test('with the tag of its own element, each part renders what it renders with no `as`', async () => {
    const plain = await mountParts();
    const html = elementsHtml(plain.root);
    plain.unmount();
    const { root } = await mountParts({ as: TAGS });
    expect(elementsHtml(root)).toBe(html);
  });

  test('with another tag, each part renders that tag with its content, and a template ref gives it', async () => {
    const { root, exposed } = await mountParts({ as: SECTIONS });
    for (const part of PARTS) {
      const element = partElement(root, part);
      expect(element.localName, part).toBe('section');
      expect(elementOf(exposed, part), part).toBe(element);
    }
    expect(partElement(root, 'Tabs.Tab')).not.toHaveAttribute('type');
    expect(partElement(root, 'Tabs.Tab')).toHaveAttribute('role', 'tab');
    expect(partElement(root, 'Button')).not.toHaveAttribute('type');
    expect(partElement(root, 'Button')).toHaveAttribute('role', 'button');
    // NVDA and JAWS read the hidden text of a progress bar and of a meter.
    for (const part of ['Progress.Root', 'Meter.Root']) {
      expect(partElement(root, part).lastElementChild).toHaveAttribute('role', 'presentation');
    }
  });

  test.each(PARTS.flatMap((part) => COMPONENTS.map((component) => ({ part, ...component }))))(
    'with the component $name, the template ref of $part gives the element of the component',
    async ({ part, name, element }) => {
      const { root, exposed } = mount(AsParts, { as: { [part]: name } });
      await nextTick();
      const given = partElement(root, part);
      expect(given.localName).toBe(element);
      expect(elementOf(exposed, part)).toBe(given);
    },
  );

  test('a component that exposes `element` gives the part its exposed element only, also while it is null', async () => {
    const { root, exposed } = mount(AsParts, { as: { Separator: 'LateElement' } });
    expect(elementOf(exposed, 'Separator')).toBeNull();
    await nextTick();
    await nextTick();
    expect(elementOf(exposed, 'Separator')).toBe(partElement(root, 'Separator'));
  });

  test('the attribute of the developer wins over the attribute of the part', async () => {
    const { root } = await mountParts({
      as: { Separator: 'section', 'Tabs.Tab': 'button' },
      attributes: { Separator: { role: 'presentation' }, 'Tabs.Tab': { type: 'submit' } },
    });
    expect(partElement(root, 'Separator')).toHaveAttribute('role', 'presentation');
    expect(partElement(root, 'Tabs.Tab')).toHaveAttribute('type', 'submit');
  });

  test('with no `as`, a part renders its own element, also when the app registers a component of that name', async () => {
    const root = document.body.appendChild(document.createElement('div'));
    const parts = createAppOf(AsParts, {}, false);
    // `<component :is="'span'">` resolves a component that the app registers as `Span`.
    for (const tag of new Set(Object.values(TAGS))) {
      parts.component(tag[0]!.toUpperCase() + tag.slice(1), MeasureRegisteredButton);
    }
    parts.mount(root);
    onTestFinished(() => {
      parts.unmount();
      root.remove();
    });
    await waitFor(() => expect(partElement(root, 'ScrollArea.Corner')).not.toBeNull());
    for (const [part, tag] of Object.entries(TAGS)) {
      expect(partElement(root, part).localName, part).toBe(tag);
    }
    expect(root.querySelector('[data-registered-button]')).toBeNull();
  });

  test('the element slot wins over `as`', async () => {
    const { root } = await mountParts();
    const [button, separator, tab] = root.querySelectorAll('[data-part="slot-wins"]');
    expect(button!.localName).toBe('button');
    expect(button).toHaveAttribute('type', 'button');
    expect(separator!.localName).toBe('span');
    expect(separator).toHaveAttribute('role', 'separator');
    expect(tab!.localName).toBe('button');
    expect(tab).toHaveAttribute('type', 'button');
  });

  test('a void element, such as <hr>, hydrates with no message', async () => {
    const as = { Separator: 'hr' };
    const root = await renderOnServer('AsParts', { as });
    const separator = partElement(root, 'Separator');
    expect(separator.localName).toBe('hr');
    const exposed = hydrate(AsParts, { as }, root);
    await nextTick();
    expect(elementOf(exposed, 'Separator')).toBe(separator);
  });

  test('the server HTML has the tag and the attributes of the client, and the hydration keeps each element with no message', async () => {
    const as = { ...SECTIONS, 'Tabs.Tab': 'div', Button: 'div' };
    const root = await renderOnServer('AsParts', { as });
    // The corner shows after the root measures the overflow.
    const parts = PARTS.filter((part) => part !== 'ScrollArea.Corner');
    const elements = parts.map((part) => partElement(root, part));
    expect(elements.map((element) => element.localName)).toEqual(
      parts.map((part) => as[part as keyof typeof as]),
    );
    // A tab and a button in a <div> have no `type`, and the button has the role and the tab stop.
    const read = (element: Element) =>
      Object.fromEntries(
        ['type', 'role', 'tabindex'].map((name) => [name, element.getAttribute(name)]),
      );
    const tab = partElement(root, 'Tabs.Tab');
    const button = partElement(root, 'Button');
    const slotButton = root.querySelector('[data-part="slot-wins"]')!;
    const expected = [
      { type: null, role: 'tab', tabindex: '0' },
      { type: null, role: 'button', tabindex: '0' },
      // The slot wins over `as`, and the part knows its element after the mount.
      { type: 'button', role: null, tabindex: null },
    ];
    expect([tab, button, slotButton].map(read)).toEqual(expected);
    const exposed = hydrate(AsParts, { as }, root);
    await nextTick();
    parts.forEach((part, index) => expect(elementOf(exposed, part), part).toBe(elements[index]));
    expect([tab, button, slotButton].map(read)).toEqual(expected);
  });
});
