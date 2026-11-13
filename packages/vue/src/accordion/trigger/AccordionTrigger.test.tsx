import { expect, describe, it } from 'vitest';
import { defineComponent } from 'vue';
import { Accordion } from '@vase-ui/vue/accordion';
import { describeConformance, createRenderer, screen } from '#test-utils';
import { useAccordionItemContext } from '../item/AccordionItemContext';
import type { AccordionItemContext } from '../item/AccordionItemContext';

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

  it.each([
    { name: 'the root', root: true, item: false, trigger: false },
    { name: 'the item', root: false, item: true, trigger: false },
    { name: 'the trigger', root: false, item: false, trigger: true },
  ])('is disabled when $name is disabled', async ({ root, item, trigger: own }) => {
    await render(
      <Accordion.Root disabled={root}>
        <Accordion.Item disabled={item}>
          <Accordion.Header>
            <Accordion.Trigger disabled={own}>Trigger</Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
      </Accordion.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute('data-disabled');
    // The header has the state of the item, and the item does not read the trigger.
    expect(trigger.parentElement!.hasAttribute('data-disabled')).toBe(root || item);
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
});
