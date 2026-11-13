import { expect, describe, it } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import { Accordion } from '@vase-ui/vue/accordion';
import { describeConformance, createRenderer, flushMicrotasks, screen } from '#test-utils';
import { useAccordionItemContext } from '../item/AccordionItemContext';
import type { AccordionItemContext } from '../item/AccordionItemContext';
import AccordionTriggerReplacement from './AccordionTriggerReplacement.test.vue';

describe('<Accordion.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(<Accordion.Trigger />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testRenderPropWith: 'button',
    button: true,
    render: (node) =>
      render(
        <Accordion.Root>
          <Accordion.Item>{node}</Accordion.Item>
        </Accordion.Root>,
      ),
  }));

  it('renders the disabled attribute when disabled', async () => {
    await render(
      <Accordion.Root>
        <Accordion.Item disabled>
          <Accordion.Header>
            <Accordion.Trigger>Trigger</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Panel</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger).toBeDisabled();
    expect(trigger).not.toHaveAttribute('aria-disabled');
  });

  it('adds data-disabled when only the trigger is disabled', async () => {
    await render(
      <Accordion.Root>
        <Accordion.Item>
          <Accordion.Header>
            <Accordion.Trigger disabled>Trigger</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Panel</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>,
    );

    expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute('data-disabled');
  });

  it('removes a disabled non-native trigger from the tab order', async () => {
    const { user } = await render(
      <Accordion.Root>
        <Accordion.Item disabled>
          <Accordion.Header>
            <Accordion.Trigger nativeButton={false} as="span">
              Trigger
            </Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
      </Accordion.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    expect(trigger).toHaveAttribute('tabindex', '-1');
    expect(trigger).not.toHaveAttribute('disabled');

    await user.keyboard('[Tab]');
    expect(trigger).not.toHaveFocus();
  });

  it('keeps a non-native trigger tabbable', async () => {
    await render(
      <Accordion.Root>
        <Accordion.Item>
          <Accordion.Header>
            <Accordion.Trigger nativeButton={false} as="span">
              Trigger
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Panel</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger).toHaveAttribute('tabindex', '0');
  });

  it('does not render the root value as data-value', async () => {
    await render(
      <Accordion.Root value={['a', 'b']} multiple>
        <Accordion.Item value="a">
          <Accordion.Header>
            <Accordion.Trigger>header a</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>panel a</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="b">
          <Accordion.Header>
            <Accordion.Trigger>header b</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>panel b</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>,
    );

    const triggers = screen.getAllByRole('button');
    expect(triggers[0]).not.toHaveAttribute('data-value');
    expect(triggers[1]).not.toHaveAttribute('data-value');
  });

  it('renders data-index on every trigger including the first', async () => {
    await render(
      <Accordion.Root>
        <Accordion.Item>
          <Accordion.Header>
            <Accordion.Trigger>first</Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
        <Accordion.Item>
          <Accordion.Header>
            <Accordion.Trigger>second</Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
      </Accordion.Root>,
    );

    const triggers = screen.getAllByRole('button');
    expect(triggers[0]).toHaveAttribute('data-index', '0');
    expect(triggers[1]).toHaveAttribute('data-index', '1');
  });

  it('keeps data-panel-open instead of data-open', async () => {
    await render(
      <Accordion.Root value={['a']}>
        <Accordion.Item value="a">
          <Accordion.Header>
            <Accordion.Trigger>header a</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>panel a</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'header a' });
    expect(trigger).toHaveAttribute('data-panel-open');
    expect(trigger).not.toHaveAttribute('data-open');
  });

  describe('prop: disabled', () => {
    it('is a disabled button that stays closed when only the trigger is disabled', async () => {
      const { user } = await render(
        <Accordion.Root>
          <Accordion.Item>
            <Accordion.Header>
              <Accordion.Trigger disabled>Trigger</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>Panel</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      expect(trigger).toBeDisabled();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      await user.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('prop: id', () => {
    // The item makes the generated id. The probe reads it, so that no case writes a generated id.
    let itemContext!: AccordionItemContext;
    const ItemProbe = defineComponent(() => {
      itemContext = useAccordionItemContext();
      return () => null;
    });

    function App({ id }: { id: string | undefined }) {
      return (
        <Accordion.Root>
          <Accordion.Item>
            <ItemProbe />
            <Accordion.Header>
              <Accordion.Trigger id={id}>Trigger</Accordion.Trigger>
            </Accordion.Header>
          </Accordion.Item>
        </Accordion.Root>
      );
    }

    it.each([
      { name: 'is undefined', first: undefined, second: undefined },
      { name: 'is empty', first: '', second: '' },
      { name: 'is set', first: 'mine', second: 'other' },
      { name: 'is removed later', first: 'mine', second: undefined },
      { name: 'is emptied later', first: 'mine', second: '' },
    ])('has the set id, or else the generated id, when the id $name', async ({ first, second }) => {
      const { rerender } = await render(<App id={first} />);
      const trigger = screen.getByRole('button');

      expect(trigger).toHaveAttribute('id', first || itemContext.defaultTriggerId.value);

      await rerender(<App id={second} />);

      expect(trigger).toHaveAttribute('id', second || itemContext.defaultTriggerId.value);
    });
  });

  describe('the id that the panel names', () => {
    it('is the id of a trigger that replaces a trigger', async () => {
      const first = shallowRef(true);
      await render(() => <AccordionTriggerReplacement first={first.value} />);

      expect(screen.getByTestId('panel')).toHaveAttribute(
        'aria-labelledby',
        screen.getByRole('button').id,
      );

      first.value = false;
      await flushMicrotasks();

      expect(screen.getByRole('button')).toHaveTextContent('Second');
      expect(screen.getByTestId('panel')).toHaveAttribute(
        'aria-labelledby',
        screen.getByRole('button').id,
      );
    });

    it('VUE-15: names the last of two triggers in aria-labelledby, then the trigger that stays when the last trigger unmounts', async () => {
      function App({ secondTriggerMounted }: { secondTriggerMounted: boolean }) {
        return (
          <Accordion.Root defaultValue={['a']}>
            <Accordion.Item value="a">
              <Accordion.Header>
                <Accordion.Trigger id="first-trigger-id">First</Accordion.Trigger>
                {secondTriggerMounted && (
                  <Accordion.Trigger id="second-trigger-id">Second</Accordion.Trigger>
                )}
              </Accordion.Header>
              <Accordion.Panel data-testid="panel">Panel</Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>
        );
      }

      const { rerender } = await render(<App secondTriggerMounted />);
      const panel = screen.getByTestId('panel');

      expect(panel).toHaveAttribute('aria-labelledby', 'second-trigger-id');

      await rerender(<App secondTriggerMounted={false} />);

      expect(panel).toHaveAttribute('aria-labelledby', 'first-trigger-id');
    });

    it('is not the id of a trigger that KeepAlive deactivates', async () => {
      const visible = shallowRef(true);
      await render(() => (
        <Accordion.Root defaultValue={['a']}>
          <Accordion.Item value="a">
            <Accordion.Header>
              <KeepAlive>
                {visible.value ? <Accordion.Trigger>A</Accordion.Trigger> : null}
              </KeepAlive>
            </Accordion.Header>
            <Accordion.Panel data-testid="panel">Panel</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));

      const panel = screen.getByTestId('panel');
      const trigger = screen.getByRole('button');
      expect(panel).toHaveAttribute('aria-labelledby', trigger.id);

      visible.value = false;
      await flushMicrotasks();

      expect(panel).not.toHaveAttribute('aria-labelledby');

      visible.value = true;
      await flushMicrotasks();

      expect(panel).toHaveAttribute('aria-labelledby', trigger.id);
    });
  });
});
