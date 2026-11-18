import { describe, expect, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import type { Component, PropType } from 'vue';
import { createRenderer, flushMicrotasks, isVaporApp, screen, waitFor } from '#test-utils';
import * as Menu from '../../menu/index.parts';
import VaporItemConsumer from './VaporItemConsumer.test.vue';

// A Vapor component needs Vue 3.6 and an app with the interop plugin. Only the projects `vapor`
// and `vapor-parts` have both.
describe.runIf(isVaporApp)('VUE-129: the slot of a Vapor component in a hidden filter item', () => {
  const { render } = createRenderer();

  const FilterableMenu = defineComponent({
    props: {
      value: { type: String, required: true },
      text: { type: String, default: '' },
      content: { type: Object as PropType<Component>, default: undefined },
      itemLabel: { type: String, default: undefined },
      onContent: { type: Function as PropType<(element: Element) => void>, required: true },
    },
    setup: (props) => () => (
      <Menu.FilterProvider modelValue={props.value}>
        <Menu.Root open>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List data-testid="list">
                  <VaporItemConsumer
                    text={props.text}
                    content={props.content}
                    itemLabel={props.itemLabel}
                    onContent={props.onContent}
                  />
                  <Menu.Item>Delete</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ),
  });

  async function renderMenu(props: { text?: string; content?: Component; itemLabel?: string }) {
    const contentElements = new Set<Element>();
    const result = await render(
      <FilterableMenu value="" {...props} onContent={(element) => contentElements.add(element)} />,
    );
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeVisible();
    });
    return { ...result, contentElements };
  }

  it('compiles the consumer as a Vapor component', () => {
    expect((VaporItemConsumer as { __vapor?: boolean }).__vapor).toBe(true);
  });

  it('matches the changed text of an item that the query hides', async () => {
    const { setProps } = await renderMenu({ text: 'Rename' });

    // `setProps` merges its argument into the props of the first render.
    await setProps({ value: 'del' });
    expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
    await setProps({ value: 'del', text: 'Duplicate' });
    await setProps({ value: 'dup', text: 'Duplicate' });

    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible();
  });

  it('matches the changed text of a component in an item that the query hides', async () => {
    const text = shallowRef('Rename');
    const LiveText = defineComponent(() => () => text.value);
    const { setProps } = await renderMenu({ content: LiveText });

    await setProps({ value: 'dup' });
    expect(screen.queryByRole('menuitem')).toBe(null);
    text.value = 'Duplicate';

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible();
    });
  });

  it('mounts the content of a hidden item in an element that is not in the document', async () => {
    const { setProps, contentElements } = await renderMenu({ text: 'Rename' });
    expect(contentElements.size).toBe(1);

    await setProps({ value: 'del' });

    expect(screen.getByTestId('list').children).toHaveLength(1);
    expect(contentElements.size).toBe(2);
    expect([...contentElements].filter((element) => element.isConnected)).toEqual([]);
  });

  it('does not mount the content of a hidden item that has a label', async () => {
    const { setProps, contentElements } = await renderMenu({
      text: 'Rename',
      itemLabel: 'Rename',
    });

    await setProps({ value: 'del' });
    await flushMicrotasks();

    expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
    expect(contentElements.size).toBe(1);
  });

  it('matches the changed text of a hidden item when its label becomes undefined', async () => {
    const { setProps, contentElements } = await renderMenu({
      text: 'Rename',
      itemLabel: 'Rename',
    });

    await setProps({ value: 'del' });
    await setProps({ value: 'del', text: 'Duplicate' });
    expect(contentElements.size).toBe(1);
    await setProps({ value: 'del', text: 'Duplicate', itemLabel: undefined });
    expect(screen.queryByRole('menuitem', { name: 'Duplicate' })).toBe(null);
    await setProps({ value: 'dup', text: 'Duplicate', itemLabel: undefined });

    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible();
  });

  it('keeps the text of the element when the label goes in the flush that hides the item', async () => {
    // Each mount of the content renders another text, so the case can tell the two texts apart.
    let mounts = 0;
    const MountNumber = defineComponent(() => {
      mounts += 1;
      const text = `Mount ${mounts}`;
      return () => text;
    });
    const { setProps } = await renderMenu({ content: MountNumber, itemLabel: 'Rename' });
    expect(screen.getByRole('menuitem', { name: 'Mount 1' })).toBeVisible();

    await setProps({ value: 'del', itemLabel: undefined });
    await setProps({ value: 'mount 2', itemLabel: undefined });

    expect(screen.queryByRole('menuitem')).toBe(null);
    expect(mounts).toBe(2);
  });
});
