import { describe, expect, it } from 'vitest';
import { KeepAlive, defineComponent, h, shallowRef } from 'vue';
import type { Component, Ref, VNode } from 'vue';
import { Accordion } from '@vase-ui/vue/accordion';
import { Collapsible } from '@vase-ui/vue/collapsible';
import { Combobox } from '@vase-ui/vue/combobox';
import { Menu } from '@vase-ui/vue/menu';
import { Resizable } from '@vase-ui/vue/resizable';
import { Select } from '@vase-ui/vue/select';
import { Slider } from '@vase-ui/vue/slider';
import { Toast } from '@vase-ui/vue/toast';
import type { HTMLProps } from '@vase-ui/vue/types';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import * as Calendar from '../../calendar/index.parts';
import CalendarAncestors from '../../calendar/root/CalendarAncestors.test.vue';
import { createIdRegistry } from './createIdRegistry';
import { useRegisteredId } from './useRegisteredId';

interface SlotProps {
  props: HTMLProps;
}

interface ChildrenSlotProps extends SlotProps {
  children: Component;
}

const toast = { id: 'test', title: 'Title', description: 'Description' };

describe('useRegisteredId', () => {
  const { render } = createRenderer();

  describe('the id of the element', () => {
    function setup(getId: () => string | undefined = () => 'bound') {
      const { ids, registerId } = createIdRegistry();
      const slotId = shallowRef<string | undefined>('first');
      const shown = shallowRef(true);
      const beforeMount: string[][] = [];
      const Part = defineComponent(() => {
        const element = shallowRef<HTMLElement | null>(null);
        useRegisteredId(getId, registerId, element);
        beforeMount.push([...ids.value]);
        return () => (shown.value ? <div ref={element} id={slotId.value} /> : null);
      });
      return { Part, beforeMount, ids, shown, slotId };
    }

    it('gives the id of the part before the mount, and the id of the element from the mount on', async () => {
      const { Part, beforeMount, ids } = setup();

      await render(<Part />);

      expect(beforeMount).toEqual([['bound']]);
      expect(ids.value).toEqual(['first']);
    });

    it('follows each change of the id of the element', async () => {
      const { Part, ids, slotId } = setup();
      await render(<Part />);

      slotId.value = 'second';
      await flushMicrotasks();

      expect(ids.value).toEqual(['second']);
    });

    it.each([
      { name: 'an empty id', id: '' },
      { name: 'no id', id: undefined },
    ])('gives no id while the element has $name', async ({ id }) => {
      const { Part, ids, slotId } = setup();
      await render(<Part />);

      slotId.value = id;
      await flushMicrotasks();

      expect(ids.value).toEqual([]);
    });

    it('gives no id while the part has no element', async () => {
      const { Part, ids, shown } = setup();
      await render(<Part />);

      shown.value = false;
      await flushMicrotasks();

      expect(ids.value).toEqual([]);
    });

    it('gives no id while the part has no id, also with an element that has one', async () => {
      const hasId = shallowRef(true);
      const { Part, ids } = setup(() => (hasId.value ? 'bound' : undefined));
      await render(<Part />);

      hasId.value = false;
      await flushMicrotasks();

      expect(ids.value).toEqual([]);
    });

    it('gives no id while KeepAlive holds the part', async () => {
      const { Part, ids } = setup();
      const active = shallowRef(true);
      await render(() => <KeepAlive>{active.value ? <Part /> : null}</KeepAlive>);

      active.value = false;
      await flushMicrotasks();
      const held = [...ids.value];
      active.value = true;
      await flushMicrotasks();

      expect(held).toEqual([]);
      expect(ids.value).toEqual(['first']);
    });
  });

  it('does not render a reader again at the mount while the element has the id of the part', async () => {
    const { ids, registerId } = createIdRegistry();
    let renders = 0;
    const Part = defineComponent(() => {
      const element = shallowRef<HTMLElement | null>(null);
      useRegisteredId(() => 'bound', registerId, element);
      return () => <div ref={element} id="bound" />;
    });
    const Reader = defineComponent(() => () => {
      renders += 1;
      return <output>{ids.value.join(' ')}</output>;
    });

    await render(() => (
      <>
        <Part />
        <Reader />
      </>
    ));
    await flushMicrotasks();

    expect(renders).toBe(1);
  });

  describe('VUE-121: a reference names the id that the #render slot gives the element', () => {
    function slot(tag: string, id: Ref<string>) {
      return { render: ({ props }: SlotProps) => h(tag, { ...props, id: id.value }) };
    }

    function childrenSlot(tag: string, id: Ref<string>) {
      return {
        render: ({ props, children }: ChildrenSlotProps) =>
          h(tag, { ...props, id: id.value }, h(children)),
      };
    }

    const rows: {
      name: string;
      attribute: string;
      render: (id: Ref<string>) => VNode;
    }[] = [
      {
        name: 'Accordion.Trigger',
        attribute: 'aria-labelledby',
        render: (id) => (
          <Accordion.Root defaultValue={['a']}>
            <Accordion.Item value="a">
              <Accordion.Header>
                <Accordion.Trigger v-slots={slot('button', id)} />
              </Accordion.Header>
              <Accordion.Panel data-testid="named">Panel</Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>
        ),
      },
      {
        name: 'Accordion.Panel',
        attribute: 'aria-controls',
        render: (id) => (
          <Accordion.Root defaultValue={['a']}>
            <Accordion.Item value="a">
              <Accordion.Header>
                <Accordion.Trigger data-testid="named">A</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel v-slots={slot('div', id)} />
            </Accordion.Item>
          </Accordion.Root>
        ),
      },
      {
        name: 'Collapsible.Panel',
        attribute: 'aria-controls',
        render: (id) => (
          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger data-testid="named">Toggle</Collapsible.Trigger>
            <Collapsible.Panel v-slots={slot('div', id)} />
          </Collapsible.Root>
        ),
      },
      {
        name: 'Menu.GroupLabel in Menu.Group',
        attribute: 'aria-labelledby',
        render: (id) => (
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Group data-testid="named">
                    <Menu.GroupLabel v-slots={slot('div', id)} />
                    <Menu.Item>One</Menu.Item>
                  </Menu.Group>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ),
      },
      {
        name: 'Menu.GroupLabel in Menu.RadioGroup',
        attribute: 'aria-labelledby',
        render: (id) => (
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.RadioGroup data-testid="named">
                    <Menu.GroupLabel v-slots={slot('div', id)} />
                    <Menu.RadioItem value="a">One</Menu.RadioItem>
                  </Menu.RadioGroup>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ),
      },
      {
        name: 'Select.GroupLabel',
        attribute: 'aria-labelledby',
        render: (id) => (
          <Select.Root open>
            <Select.Group data-testid="named">
              <Select.GroupLabel v-slots={slot('div', id)} />
            </Select.Group>
          </Select.Root>
        ),
      },
      {
        name: 'Combobox.GroupLabel',
        attribute: 'aria-labelledby',
        render: (id) => (
          <Combobox.Root open>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Group data-testid="named">
                    <Combobox.GroupLabel v-slots={slot('div', id)} />
                  </Combobox.Group>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ),
      },
      {
        name: 'Toast.Title',
        attribute: 'aria-labelledby',
        render: (id) => (
          <Toast.Provider>
            <Toast.Viewport>
              <Toast.Root toast={toast} data-testid="named">
                <Toast.Title v-slots={childrenSlot('h2', id)} />
              </Toast.Root>
            </Toast.Viewport>
          </Toast.Provider>
        ),
      },
      {
        name: 'Toast.Description',
        attribute: 'aria-describedby',
        render: (id) => (
          <Toast.Provider>
            <Toast.Viewport>
              <Toast.Root toast={toast} data-testid="named">
                <Toast.Title />
                <Toast.Description v-slots={childrenSlot('p', id)} />
              </Toast.Root>
            </Toast.Viewport>
          </Toast.Provider>
        ),
      },
      {
        name: 'Calendar.Caption',
        attribute: 'aria-labelledby',
        render: (id) => (
          <CalendarAncestors level="month">
            <Calendar.Caption v-slots={slot('div', id)} />
            <Calendar.Grid data-testid="named" />
          </CalendarAncestors>
        ),
      },
      {
        name: 'Select.Label',
        attribute: 'aria-labelledby',
        render: (id) => (
          <Select.Root>
            <Select.Label v-slots={slot('div', id)} />
            <Select.Trigger data-testid="named" />
          </Select.Root>
        ),
      },
      {
        name: 'Combobox.Label',
        attribute: 'aria-labelledby',
        render: (id) => (
          <Combobox.Root>
            <Combobox.Label v-slots={slot('div', id)} />
            <Combobox.Trigger data-testid="named" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ),
      },
      {
        name: 'Slider.Label',
        attribute: 'aria-labelledby',
        render: (id) => (
          <Slider.Root defaultValue={50} data-testid="named">
            <Slider.Label v-slots={slot('div', id)} />
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        ),
      },
      {
        name: 'Resizable.Panel',
        attribute: 'aria-controls',
        render: (id) => (
          <Resizable.Root>
            <Resizable.Panel id="a" v-slots={slot('div', id)} />
            <Resizable.Handle data-testid="named" />
            <Resizable.Panel id="b" />
          </Resizable.Root>
        ),
      },
      {
        name: 'Resizable.Panel with disabled handle',
        attribute: 'aria-controls',
        render: (id) => (
          <Resizable.Root>
            <Resizable.Panel id="a" v-slots={slot('div', id)} />
            <Resizable.Handle disabled data-testid="named" />
            <Resizable.Panel id="b" />
          </Resizable.Root>
        ),
      },
    ];

    it.each(rows)('$name', async ({ attribute, render: renderRow }) => {
      const id = shallowRef('first');
      await render(() => renderRow(id));
      await flushMicrotasks();
      const named = screen.getByTestId('named');
      const steps = [named.getAttribute(attribute)];

      id.value = 'second';
      await flushMicrotasks();
      steps.push(named.getAttribute(attribute));
      const element = document.getElementById('second');

      id.value = '';
      await flushMicrotasks();
      steps.push(named.getAttribute(attribute));

      expect(steps).toEqual(['first', 'second', null]);
      expect(element).not.toBeNull();
    });
  });
});
