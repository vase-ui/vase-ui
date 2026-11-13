import { expect, vi, describe, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { Accordion } from '@vase-ui/vue/accordion';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  hydrate,
  renderOnServer,
  screen,
  waitFor,
} from '#test-utils';
import AccordionRootHydration from './AccordionRootHydration.test.vue';
import AccordionRootList from './AccordionRootList.test.vue';

const HYDRATION_FIXTURE = 'src/accordion/root/AccordionRootHydration.test.vue';

/** The text and the `data-index` of each trigger, in the order of the document. */
function readTriggers(root: ParentNode) {
  return [...root.querySelectorAll('button')].map(
    (trigger) => `${trigger.textContent}:${trigger.getAttribute('data-index')}`,
  );
}

describe('<Accordion.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<Accordion.Root />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  describe('v-model:value', () => {
    /**
     * An accordion with the items `a` and `b` and a parent that holds the value. `log` gets one
     * line for each emit.
     */
    async function renderModel(options: {
      multiple?: boolean;
      cancel?: 'openChange' | 'valueChange';
    }) {
      const log: string[] = [];
      const App = defineComponent(() => {
        const value = shallowRef<string[]>([]);

        return () => (
          <Accordion.Root
            multiple={options.multiple}
            value={value.value}
            onValueChange={(nextValue, eventDetails) => {
              log.push(`valueChange ${nextValue.join()}`);
              if (options.cancel === 'valueChange') {
                eventDetails.cancel();
              }
            }}
            onUpdate:value={(nextValue) => {
              log.push(`update:value ${nextValue.join()}`);
              value.value = nextValue;
            }}
          >
            {['a', 'b'].map((itemValue) => (
              <Accordion.Item
                key={itemValue}
                value={itemValue}
                onOpenChange={(open, eventDetails) => {
                  log.push(`openChange ${itemValue} ${open}`);
                  if (options.cancel === 'openChange') {
                    eventDetails.cancel();
                  }
                }}
              >
                <Accordion.Header>
                  <Accordion.Trigger>{itemValue}</Accordion.Trigger>
                </Accordion.Header>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        );
      });

      await render(<App />);
      const [triggerA, triggerB] = screen.getAllByRole('button');

      return { log, triggerA, triggerB };
    }

    it('emits openChange, then valueChange, then update:value', async () => {
      const { log, triggerA } = await renderModel({});

      await fireEvent.click(triggerA);

      expect(log).toEqual(['openChange a true', 'valueChange a', 'update:value a']);
      expect(triggerA).toHaveAttribute('aria-expanded', 'true');
      expect(triggerA).toHaveAttribute('data-panel-open');
    });

    it('does not emit update:value when a listener cancels valueChange', async () => {
      const { log, triggerA } = await renderModel({ cancel: 'valueChange' });

      await fireEvent.click(triggerA);

      expect(log).toEqual(['openChange a true', 'valueChange a']);
      expect(triggerA).toHaveAttribute('aria-expanded', 'false');
    });

    it('does not emit valueChange when a listener cancels openChange', async () => {
      const { log, triggerA } = await renderModel({ cancel: 'openChange' });

      await fireEvent.click(triggerA);

      expect(log).toEqual(['openChange a true']);
      expect(triggerA).toHaveAttribute('aria-expanded', 'false');
    });

    it('holds one value when multiple is false', async () => {
      const { log, triggerA, triggerB } = await renderModel({});

      await fireEvent.click(triggerA);
      await fireEvent.click(triggerB);

      expect(log.at(-1)).toBe('update:value b');
      expect(triggerA).toHaveAttribute('aria-expanded', 'false');
      expect(triggerB).toHaveAttribute('aria-expanded', 'true');

      await fireEvent.click(triggerB);

      expect(log.at(-1)).toBe('update:value ');
      expect(triggerB).toHaveAttribute('aria-expanded', 'false');
    });

    it('adds and removes a value when multiple is true', async () => {
      const { log, triggerA, triggerB } = await renderModel({ multiple: true });

      await fireEvent.click(triggerA);
      await fireEvent.click(triggerB);

      expect(log.at(-1)).toBe('update:value a,b');

      await fireEvent.click(triggerA);

      expect(log.at(-1)).toBe('update:value b');
      expect(triggerA).toHaveAttribute('aria-expanded', 'false');
      expect(triggerB).toHaveAttribute('aria-expanded', 'true');
    });

    it('keeps the open state when the parent does not write the controlled value', async () => {
      const onValueChange = vi.fn();

      await render(
        <Accordion.Root value={[]} onValueChange={onValueChange}>
          <Accordion.Item value="a">
            <Accordion.Header>
              <Accordion.Trigger>a</Accordion.Trigger>
            </Accordion.Header>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.click(trigger);

      expect(onValueChange.mock.lastCall?.[0]).toEqual(['a']);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('gives a generated value to an item that has no value', async () => {
      const onValueChange = vi.fn();

      await render(
        <Accordion.Root multiple onValueChange={onValueChange}>
          <Accordion.Item>
            <Accordion.Header>
              <Accordion.Trigger>a</Accordion.Trigger>
            </Accordion.Header>
          </Accordion.Item>
          <Accordion.Item>
            <Accordion.Header>
              <Accordion.Trigger>b</Accordion.Trigger>
            </Accordion.Header>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const [triggerA, triggerB] = screen.getAllByRole('button');

      await fireEvent.click(triggerA);
      await fireEvent.click(triggerB);

      const value: string[] = onValueChange.mock.lastCall?.[0];
      expect(value).toHaveLength(2);
      expect(value[0]).toMatch(/^vase-ui-/);
      expect(value[1]).toMatch(/^vase-ui-/);
      expect(value[0]).not.toBe(value[1]);
      expect(triggerA).toHaveAttribute('aria-expanded', 'true');
      expect(triggerB).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('the index of an item', () => {
    it('follows a new order, a removal and an addition', async () => {
      const values = shallowRef(['a', 'b', 'c']);
      const hiddenValue = shallowRef<string | undefined>();

      const { container } = await render(() => (
        <AccordionRootList values={values.value} hiddenValue={hiddenValue.value} />
      ));

      expect(readTriggers(container)).toEqual(['a:0', 'b:1', 'c:2']);

      values.value = ['c', 'a', 'b'];

      await waitFor(() => {
        expect(readTriggers(container)).toEqual(['c:0', 'a:1', 'b:2']);
      });

      hiddenValue.value = 'a';

      await waitFor(() => {
        expect(readTriggers(container)).toEqual(['c:0', 'b:1']);
      });

      hiddenValue.value = undefined;

      await waitFor(() => {
        expect(readTriggers(container)).toEqual(['c:0', 'a:1', 'b:2']);
      });
    });
  });

  describe('hydration', () => {
    it.each([
      { name: 'closed items', props: {}, open: [false, false] },
      { name: 'an open item', props: { defaultValue: [0] }, open: [true, false] },
    ])('hydrates $name with no warning and no DOM difference', async ({ props, open }) => {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      // The parse in a `<template>` element has no side effect.
      const server = document.createElement('template');
      server.innerHTML = serverHtml;
      const serverItems = [...server.content.firstElementChild!.children];
      const serverTriggers = [...server.content.querySelectorAll('button')];
      expect(readTriggers(server.content)).toEqual(['Trigger 1:0', 'Trigger 2:1']);
      expect(serverTriggers.map((trigger) => trigger.getAttribute('aria-expanded'))).toEqual(
        open.map(String),
      );
      expect(serverItems.map((item) => item.hasAttribute('data-open'))).toEqual(open);
      expect(serverItems.map((item) => item.hasAttribute('data-hidden'))).toEqual(
        open.map((isOpen) => !isOpen),
      );
      // The value is state, and no part writes it as an attribute.
      expect(serverHtml).not.toContain('data-value');
      const serverIds = serverTriggers.map((trigger) => trigger.id);
      expect(serverIds[0]).toMatch(/^vase-ui-/);
      expect(serverIds[1]).toMatch(/^vase-ui-/);
      expect(serverIds[0]).not.toBe(serverIds[1]);

      const { container } = await hydrate(AccordionRootHydration, { serverHtml, props });

      expect([...container.querySelectorAll('button')].map((trigger) => trigger.id)).toEqual(
        serverIds,
      );
    });
  });
});
