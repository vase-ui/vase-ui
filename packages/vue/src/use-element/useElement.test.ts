import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import PartFormScenes from '../../test/fixtures/PartFormScenes.vue';
import { mount } from '../../test/render';

/** Mounts `PartFormScenes` with `props`, and gives the elements in it and its log. */
async function mountScene(props: Record<string, unknown>) {
  const log: string[] = [];
  props.log = (entry: string) => log.push(entry);
  const { root, exposed } = mount(PartFormScenes, props);
  // A part reads the element that it renders at the mount, and then renders its attributes again.
  await nextTick();
  await nextTick();
  const ancestor = root.querySelector('.Ancestor')!;
  return { root, exposed, log, elements: () => [...ancestor.children] };
}

describe('element', () => {
  test('is the default element of the component, and null after a v-if removes the component', async () => {
    const view = reactive({ shown: true });
    const { exposed, elements } = await mountScene({ scene: 'default', view });
    const [notice] = elements();
    expect(notice!.localName).toBe('p');
    expect(notice!.getAttributeNames().sort()).toEqual(['data-testid', 'data-tone', 'role']);
    expect(notice).toHaveAttribute('data-tone', 'warning');
    const part = exposed.part as { element: Element | null };
    expect(part.element).toBe(notice);
    view.shown = false;
    await nextTick();
    expect(elements()).toEqual([]);
    expect(part.element).toBeNull();
  });

  test('is the native element in the slot, and a function ref of the developer beside elementRef gets the same element', async () => {
    const { exposed, elements } = await mountScene({ scene: 'link' });
    const [link] = elements();
    expect(link!.localName).toBe('a');
    expect(link!.getAttributeNames().sort()).toEqual(['data-tone', 'href', 'role']);
    expect(exposed.part.element).toBe(link);
    expect(exposed.mine).toBe(link);
  });

  test('is the element that a component in the slot exposes', async () => {
    const { exposed, elements } = await mountScene({ scene: 'component' });
    const [button] = elements();
    expect(button).toHaveClass('StyledButton');
    expect(button).toHaveAttribute('role', 'note');
    expect(exposed.part.element).toBe(button);
  });

  test('follows an element that a component in the slot exposes after an await', async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const { exposed, elements } = await mountScene({ scene: 'late', ready: promise });
    expect(exposed.part.element).toBeNull();
    resolve();
    await promise;
    await nextTick();
    expect(exposed.part.element).toBe(elements()[0]);
  });
});

describe('a part and a component of the developer as the element of each other', () => {
  test('a Toggle in the slot of the component is one button with the attributes of both, and a click calls each listener one time', async () => {
    const { exposed, elements, log } = await mountScene({ scene: 'toggle' });
    expect(elements()).toHaveLength(1);
    const [button] = elements();
    expect(button!.localName).toBe('button');
    expect(button!.getAttributeNames().sort()).toEqual([
      'aria-pressed',
      'data-tone',
      'role',
      'type',
    ]);
    expect(exposed.part.element).toBe(button);
    await userEvent.click(button!);
    expect(log.sort()).toEqual(['notice click', 'pressedChange', 'toggle click']);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  test('the component in the slot of a Toggle is one element with the attributes of both, and a click calls each listener one time', async () => {
    const { exposed, elements, log } = await mountScene({ scene: 'in-toggle' });
    expect(elements()).toHaveLength(1);
    const [notice] = elements();
    expect(notice!.localName).toBe('p');
    expect(notice!.getAttributeNames().sort()).toEqual([
      'aria-pressed',
      'data-tone',
      'role',
      'tabindex',
    ]);
    // The attributes of the Toggle win over those of the component.
    expect(notice).toHaveAttribute('role', 'button');
    expect(exposed.toggle.element).toBe(notice);
    expect(exposed.mine.element).toBe(notice);
    await userEvent.click(notice!);
    expect(log.sort()).toEqual(['notice click', 'pressedChange', 'toggle click']);
    expect(notice).toHaveAttribute('aria-pressed', 'true');
  });
});

test('a keyed reorder keeps the element of each component, and a removal sets the element to null', async () => {
  const keys = reactive(['a', 'b', 'c']);
  const { exposed, elements } = await mountScene({ scene: 'list', keys });
  const parts = exposed.parts as Map<string, { element: Element | null }>;
  const before = new Map([...parts].map(([key, part]) => [key, part.element]));
  expect(elements()).toEqual([before.get('a'), before.get('b'), before.get('c')]);
  keys.reverse();
  await nextTick();
  expect(elements()).toEqual([before.get('c'), before.get('b'), before.get('a')]);
  for (const [key, part] of parts) expect(part.element).toBe(before.get(key));
  const removed = parts.get('b')!;
  keys.splice(1, 1);
  await nextTick();
  expect(removed.element).toBeNull();
  expect(elements()).toEqual([before.get('c'), before.get('a')]);
  expect(parts.get('a')!.element).toBe(before.get('a'));
});
